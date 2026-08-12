import { Check, Copy, Crown, Download, Link2, MapPinned, Share2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AppView } from "../../app/navigation";
import { propertyLocation } from "../../domain/agriculturalContext";
import { CENARIOS } from "../../domain/fertilization";
import { PRECO_PADRAO_KG } from "../../domain/fertilizerProgram";
import type { FieldRecord } from "../../domain/fieldRecords";
import { parseNumberBR } from "../../domain/parseNumber";
import { resolvePlan, TRIAL_DAYS, type PlanId } from "../../domain/plans";
import { provenienciaResumo } from "../../domain/provenance";
import { soilLevelLabel } from "../../domain/soilAnalysis";
import type { AgriculturalController } from "../../lib/useAgriculturalContext";
import { supabase } from "../../lib/supabaseClient";
import type { NdviResult } from "../ndvi/types";
import type { SoilAnalysis } from "../soil/soilStore";
import {
  buildPropertyReport,
  priorityLabels,
  whatsappShareUrl,
  type FertReportPrefs,
  type PropertyReport,
} from "./buildReport";
import { BarChart } from "./charts/BarChart";
import { renderSharedReportHtml } from "./sharedReport";
import "./report.css";

const brl0 = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const brl2 = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Preferências de adubação salvas por talhão (aba Calagem e adubação).
function loadFertPrefsByPlot(plotIds: string[]): Record<string, FertReportPrefs> {
  const out: Record<string, FertReportPrefs> = {};
  if (typeof localStorage === "undefined") return out;
  for (const id of plotIds) {
    try {
      const raw = localStorage.getItem(`agryn.fert.${id}`);
      if (!raw) continue;
      const p = JSON.parse(raw) as {
        vAlvo?: number; fonteP?: string; cobertura?: string; fonteK?: string; plantas?: string; cenarioId?: string;
      };
      const cen = CENARIOS.find((c) => c.id === p.cenarioId);
      out[id] = {
        vAlvo: p.vAlvo,
        fonteP: p.fonteP,
        cobertura: p.cobertura,
        fonteK: p.fonteK,
        plantas: p.plantas ? parseNumberBR(p.plantas) ?? undefined : undefined,
        sacas: cen?.sacasPorHectare,
      };
    } catch {
      // ignora entrada inválida
    }
  }
  return out;
}

function loadFertPrecos(): Record<string, number> {
  const precos: Record<string, number> = { ...PRECO_PADRAO_KG };
  if (typeof localStorage === "undefined") return precos;
  try {
    const raw = localStorage.getItem("agryn.fert.precos");
    if (raw) {
      const map = JSON.parse(raw) as Record<string, string>;
      for (const [k, v] of Object.entries(map)) {
        const n = parseNumberBR(v);
        if (n !== null) precos[k] = n;
      }
    }
  } catch {
    // usa os padrões
  }
  return precos;
}

type ReportModuleProps = {
  agriculture: AgriculturalController;
  records: FieldRecord[];
  ndviHistory: NdviResult[];
  soilAnalyses: SoilAnalysis[];
  planId: PlanId;
  trialAvailable: boolean;
  onStartTrial?: () => void;
  onSubscribe?: () => void;
  onNavigate: (view: AppView) => void;
};

type ReportPhoto = { plotName: string; url: string; caption: string };

function UpgradeNotice({
  trialAvailable,
  onStartTrial,
  onSubscribe,
}: {
  trialAvailable: boolean;
  onStartTrial?: () => void;
  onSubscribe?: () => void;
}) {
  return (
    <div className="upgrade-notice" role="status">
      <Crown size={20} aria-hidden="true" />
      <div>
        <strong>Relatório disponível no plano Pro</strong>
        <p>
          Gere um relatório técnico consolidado (NDVI, custos e caderno de campo) por propriedade,
          pronto para entregar ao produtor.
        </p>
      </div>
      {trialAvailable && onStartTrial && (
        <button className="primary-button" type="button" onClick={onStartTrial}>
          Testar o Pro grátis por {TRIAL_DAYS} dias
        </button>
      )}
      <button className="primary-button" type="button" onClick={onSubscribe} disabled={!onSubscribe}>
        Assinar o Pro — R$ 49,90/mês
      </button>
      <a className="secondary-button" href="./landing.html#planos" target="_blank" rel="noreferrer">
        Ver planos
      </a>
    </div>
  );
}

export function ReportModule({
  agriculture,
  records,
  ndviHistory,
  soilAnalyses,
  planId,
  trialAvailable,
  onStartTrial,
  onSubscribe,
  onNavigate,
}: ReportModuleProps) {
  const { state } = agriculture;
  const [selectedPropertyId, setSelectedPropertyId] = useState(
    agriculture.selectedProperty?.id ?? state.properties[0]?.id ?? "",
  );
  const property =
    state.properties.find((candidate) => candidate.id === selectedPropertyId) ??
    state.properties[0] ??
    null;
  const plan = resolvePlan(planId);
  const isPro = plan.id === "pro";

  const report = useMemo<PropertyReport | null>(() => {
    if (!property) return null;
    return buildPropertyReport(
      property,
      state.plots,
      records,
      ndviHistory,
      soilAnalyses,
      undefined,
      loadFertPrefsByPlot(state.plots.filter((plot) => plot.propertyId === property.id).map((plot) => plot.id)),
      loadFertPrecos(),
    );
  }, [property, state.plots, records, ndviHistory, soilAnalyses]);

  // Fotos dos registros (anexos de imagem) para ilustrar o relatório. Os anexos
  // ficam num bucket privado; buscamos URLs assinadas com validade folgada para
  // aguentar o tempo de impressão do PDF.
  const photoAttachments = useMemo(() => {
    if (!property) return [];
    const nomePorTalhao = new Map(state.plots.map((plot) => [plot.id, plot.name]));
    const talhoesDaPropriedade = new Set(
      state.plots.filter((plot) => plot.propertyId === property.id).map((plot) => plot.id),
    );
    const itens: { plotName: string; path: string; caption: string }[] = [];
    for (const record of records) {
      if (!talhoesDaPropriedade.has(record.plotId)) continue;
      for (const attachment of record.attachments) {
        if (!attachment.mimeType.startsWith("image/")) continue;
        itens.push({
          plotName: nomePorTalhao.get(record.plotId) ?? "",
          path: attachment.path,
          caption: record.title || attachment.name,
        });
      }
    }
    return itens.slice(0, 12);
  }, [property, state.plots, records]);

  const [photos, setPhotos] = useState<ReportPhoto[]>([]);
  useEffect(() => {
    let active = true;
    // Promise.all([]) já resolve para [] de forma assíncrona — sem setState
    // síncrono no efeito, e ainda limpa as fotos quando não há anexos.
    void Promise.all(
      photoAttachments.map(async (item) => {
        const { data } = await supabase.storage
          .from("field-attachments")
          .createSignedUrl(item.path, 3600);
        return data?.signedUrl
          ? { plotName: item.plotName, url: data.signedUrl, caption: item.caption }
          : null;
      }),
    ).then((resultados) => {
      if (active) setPhotos(resultados.filter((item): item is ReportPhoto => item !== null));
    });
    return () => {
      active = false;
    };
  }, [photoAttachments]);

  const [shareLink, setShareLink] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [shareErro, setShareErro] = useState<string | null>(null);

  // Gera um link público protegido por token: salva um HTML autocontido do
  // relatório em shared_reports (o dono, via RLS) e devolve a URL da Edge
  // Function que serve esse HTML por 30 dias, sem exigir login de quem abre.
  async function gerarLink() {
    if (!report || !property) return;
    setSharing(true);
    setShareErro(null);
    setShareLink(null);
    try {
      const token = crypto.randomUUID();
      const html = renderSharedReportHtml(report);
      const { error } = await supabase
        .from("shared_reports")
        .insert({ id: token, property_name: property.name, html });
      if (error) throw new Error(error.message);
      const base = import.meta.env.VITE_SUPABASE_URL as string;
      setShareLink(`${base}/functions/v1/shared-report?t=${token}`);
    } catch (error) {
      setShareErro(error instanceof Error ? error.message : "Não foi possível gerar o link.");
    } finally {
      setSharing(false);
    }
  }

  async function copiarLink() {
    if (!shareLink) return;
    await navigator.clipboard.writeText(shareLink);
    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="page-stack platform-page">
      <header className="page-header context-page-header no-print">
        <div>
          <span className="eyebrow">Documentos técnicos</span>
          <h1>Relatórios</h1>
          <p>
            Consolide NDVI, custos e caderno de campo em um relatório por propriedade, pronto para
            entregar ao produtor.
          </p>
        </div>
        {state.properties.length > 0 && (
          <label className="report-property-select">
            Propriedade
            <select
              value={property?.id ?? ""}
              onChange={(event) => setSelectedPropertyId(event.target.value)}
            >
              {state.properties.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>

      {state.properties.length === 0 ? (
        <section className="empty-state context-empty">
          <MapPinned size={31} />
          <h2>Cadastre uma propriedade</h2>
          <p>O relatório é gerado a partir das propriedades e talhões cadastrados na conta.</p>
          <button type="button" onClick={() => onNavigate("propriedades")}>
            Cadastrar propriedade
          </button>
        </section>
      ) : !isPro ? (
        <UpgradeNotice trialAvailable={trialAvailable} onStartTrial={onStartTrial} onSubscribe={onSubscribe} />
      ) : report ? (
        <>
          <div className="no-print report-actions">
            <button className="primary-button" type="button" onClick={() => window.print()}>
              <Download size={16} aria-hidden="true" /> Baixar PDF
            </button>
            <a
              className="secondary-button"
              href={whatsappShareUrl(report)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Share2 size={16} aria-hidden="true" /> Enviar por WhatsApp
            </a>
            <button
              className="secondary-button"
              type="button"
              onClick={() => void gerarLink()}
              disabled={sharing}
            >
              <Link2 size={16} aria-hidden="true" />{" "}
              {sharing ? "Gerando…" : "Gerar link protegido"}
            </button>
          </div>
          {shareErro && <p className="report-share-error no-print">{shareErro}</p>}
          {shareLink && (
            <div className="report-share-link no-print">
              <input type="text" value={shareLink} readOnly aria-label="Link do relatório" />
              <button type="button" onClick={() => void copiarLink()}>
                {copiado ? <Check size={16} /> : <Copy size={16} />}
                {copiado ? "Copiado" : "Copiar"}
              </button>
              <a href={shareLink} target="_blank" rel="noopener noreferrer">
                Abrir
              </a>
              <small>Válido por 30 dias. Quem tiver o link vê o relatório, sem precisar de conta.</small>
            </div>
          )}
          <ReportDocument report={report} photos={photos} />
        </>
      ) : null}
    </div>
  );
}

function ReportDocument({ report, photos }: { report: PropertyReport; photos: ReportPhoto[] }) {
  const { property, plots, executiveSummary, conclusion, ndviChart, costByPlotChart, costByCategoryChart, totalCost, generatedAt } =
    report;
  const location = propertyLocation(property);

  return (
    <article className="report-print-area">
      <header className="report-doc-header">
        <h1>Relatório Técnico da Propriedade</h1>
        <p className="report-doc-subtitle">
          {property.name}
          {location ? ` — ${location}` : ""}
        </p>
      </header>

      <table className="report-info-table">
        <tbody>
          <tr>
            <th>Produtor</th>
            <td>{property.producer || "—"}</td>
          </tr>
          <tr>
            <th>Responsável técnico</th>
            <td>{property.responsible || "—"}</td>
          </tr>
          <tr>
            <th>Talhões avaliados</th>
            <td>{plots.length > 0 ? plots.map((row) => row.plot.name).join("; ") : "Nenhum talhão cadastrado"}</td>
          </tr>
          <tr>
            <th>Emissão</th>
            <td>
              Gerado pela AGRYN em{" "}
              {new Date(generatedAt).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </td>
          </tr>
        </tbody>
      </table>

      <h2>Diagnóstico executivo</h2>
      <div className="report-callout">{executiveSummary}</div>

      <h2>1. Resultados por talhão</h2>
      <table className="report-data-table">
        <thead>
          <tr>
            <th>Talhão</th>
            <th>Cultura</th>
            <th>Safra</th>
            <th>Área (ha)</th>
            <th>NDVI médio</th>
            <th>Última análise</th>
            <th>Prioridade</th>
          </tr>
        </thead>
        <tbody>
          {plots.map((row) => (
            <tr key={row.plot.id}>
              <td>{row.plot.name}</td>
              <td>{row.plot.crop}</td>
              <td>{row.plot.season || "—"}</td>
              <td>{row.plot.areaHectares.toLocaleString("pt-BR")}</td>
              <td>{row.ndviMean !== null ? row.ndviMean.toFixed(2) : "—"}</td>
              <td>{row.ndviDate ? new Date(row.ndviDate).toLocaleDateString("pt-BR") : "Não processado"}</td>
              <td>
                <span className={`report-priority report-priority-${row.priority}`}>
                  {priorityLabels[row.priority]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="report-chart-card">
        <h3>NDVI médio por talhão</h3>
        <BarChart data={ndviChart} formatValue={(value) => value.toFixed(2)} />
      </div>

      {plots.some((row) => row.soil) && (
        <>
          <h2>Análise de solo</h2>
          {plots
            .filter((row) => row.soil && row.soil.rows.length > 0)
            .map((row) => (
              <div className="report-soil-block" key={`soil-${row.plot.id}`}>
                <h3>
                  {row.plot.name}
                  {row.soil?.date
                    ? ` — ${new Date(row.soil.date).toLocaleDateString("pt-BR")}`
                    : ""}
                </h3>
                <table className="report-data-table">
                  <thead>
                    <tr>
                      <th>Nutriente</th>
                      <th>Valor</th>
                      <th>Faixa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(row.soil?.rows ?? []).map((item) => (
                      <tr key={item.key}>
                        <td>{item.label}</td>
                        <td>
                          {item.value.toLocaleString("pt-BR")}
                          {item.unit ? ` ${item.unit}` : ""}
                        </td>
                        <td>
                          {item.level === "informativo" ? (
                            "—"
                          ) : (
                            <span className={`report-soil-level report-soil-${item.level}`}>
                              {soilLevelLabel(item.level)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {row.soil && row.soil.alerts.length > 0 && (
                  <p className="report-soil-alerts">
                    Pontos de atenção: {row.soil.alerts.join(" ")}
                  </p>
                )}
              </div>
            ))}
        </>
      )}

      {plots
        .filter((row) => row.zones && row.zones.some((zone) => zone.percentage > 0))
        .map((row) => (
          <div className="report-zones-block" key={`zones-${row.plot.id}`}>
            <h3>Zonas de manejo — {row.plot.name}</h3>
            <table className="report-data-table">
              <thead>
                <tr>
                  <th>Zona</th>
                  <th>Faixa NDVI</th>
                  <th>% da área</th>
                  <th>Hectares</th>
                  <th>Orientação de manejo</th>
                </tr>
              </thead>
              <tbody>
                {(row.zones ?? [])
                  .filter((zone) => zone.percentage > 0)
                  .map((zone) => (
                    <tr key={zone.letter}>
                      <td>
                        <span className="report-zone-badge" style={{ background: zone.color }}>
                          {zone.letter}
                        </span>{" "}
                        {zone.label}
                      </td>
                      <td>
                        {zone.ndviMin.toFixed(2)}
                        {zone.letter === "A" ? "+" : `–${zone.ndviMax.toFixed(2)}`}
                      </td>
                      <td>{zone.percentage.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</td>
                      <td>{zone.hectares.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</td>
                      <td>{zone.guidance}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ))}

      {plots.some((row) => row.fertilizer) && (
        <>
          <h2>Adubação recomendada</h2>
          {plots
            .filter((row) => row.fertilizer)
            .map((row) => {
              const f = row.fertilizer;
              if (!f) return null;
              return (
                <div className="report-soil-block" key={`fert-${row.plot.id}`}>
                  <h3>
                    {row.plot.name} — {f.sacas} sc/ha · V% alvo {f.vAlvo}
                  </h3>
                  <p className="report-soil-alerts" style={{ color: "var(--text-soft)" }}>
                    {f.calagemDispensada
                      ? `Calagem dispensada — V% atual ${f.vAtual.toFixed(0)}% já atinge o alvo.`
                      : `Calagem: ${f.calagemTHa.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} t/ha de calcário dolomítico (V% ${f.vAtual.toFixed(0)} → ${f.vAlvo}).`}{" "}
                    NPK (kg/ha): N {f.npk.n} · P₂O₅ {f.npk.p2o5} · K₂O {f.npk.k2o} · S {f.npk.s}.
                  </p>
                  <table className="report-data-table">
                    <thead>
                      <tr>
                        <th>Insumo</th>
                        <th>Fórmula</th>
                        <th>kg/ha</th>
                        <th>g/planta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {f.itens.map((it) => (
                        <tr key={it.formula + it.nome}>
                          <td>{it.nome}</td>
                          <td>{it.formula}</td>
                          <td>{it.kgPorHectare.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</td>
                          <td>
                            {f.plantasPorHa > 0
                              ? ((it.kgPorHectare * 1000) / f.plantasPorHa).toLocaleString("pt-BR", {
                                  maximumFractionDigits: 0,
                                })
                              : "—"}
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td>
                          <strong>Total · custo</strong>
                        </td>
                        <td />
                        <td>
                          <strong>
                            {f.totalKgHa.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} kg/ha
                          </strong>
                        </td>
                        <td>
                          <strong>
                            {brl0(f.custoHa)}/ha · {brl2(f.custoSaca)}/sc
                          </strong>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  {f.kExcesso && (
                    <p className="report-soil-alerts">
                      Potássio em excesso na fórmula escolhida — com K alto no solo, prefira
                      27-00-10 ou 30-00-10.
                    </p>
                  )}
                  <p className="report-provenance">{provenienciaResumo(f.proveniencia)}</p>
                </div>
              );
            })}
        </>
      )}

      <h2>2. Custos</h2>
      <table className="report-data-table">
        <thead>
          <tr>
            <th>Talhão</th>
            <th>Total</th>
            <th>Custo/ha</th>
            <th>Lançamentos</th>
          </tr>
        </thead>
        <tbody>
          {plots.map((row) => (
            <tr key={row.plot.id}>
              <td>{row.plot.name}</td>
              <td>{row.costTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
              <td>{row.costPerHectare.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
              <td>{row.costEntries}</td>
            </tr>
          ))}
          <tr className="report-total-row">
            <td>Total da propriedade</td>
            <td>{totalCost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
            <td />
            <td />
          </tr>
        </tbody>
      </table>
      <div className="report-chart-grid">
        <div className="report-chart-card">
          <h3>Custo por talhão</h3>
          <BarChart
            data={costByPlotChart}
            formatValue={(value) =>
              value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
            }
            color="var(--warning)"
          />
        </div>
        <div className="report-chart-card">
          <h3>Custo por categoria</h3>
          <BarChart
            data={costByCategoryChart}
            formatValue={(value) =>
              value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
            }
            color="var(--info)"
          />
        </div>
      </div>

      <h2>3. Caderno de campo</h2>
      <table className="report-data-table">
        <thead>
          <tr>
            <th>Talhão</th>
            <th>Atividades concluídas</th>
            <th>Atividades planejadas</th>
          </tr>
        </thead>
        <tbody>
          {plots.map((row) => (
            <tr key={row.plot.id}>
              <td>{row.plot.name}</td>
              <td>{row.activitiesCompleted}</td>
              <td>{row.activitiesPlanned}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {photos.length > 0 && (
        <>
          <h2>Registros fotográficos</h2>
          <div className="report-photo-grid">
            {photos.map((photo, index) => (
              <figure key={`${photo.url}-${index}`} className="report-photo">
                <img src={photo.url} alt={photo.caption} />
                <figcaption>
                  {photo.caption}
                  {photo.plotName ? ` — ${photo.plotName}` : ""}
                </figcaption>
              </figure>
            ))}
          </div>
        </>
      )}

      <h2>Conclusão</h2>
      <p>{conclusion}</p>

      <div className="report-signature">
        <div className="report-signature-line">
          <span>{property.responsible || "Responsável técnico"}</span>
          <small>Responsável técnico</small>
        </div>
        <div className="report-signature-meta">
          {location ? <span>{location}</span> : null}
          <span>
            {new Date(generatedAt).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })}
          </span>
        </div>
      </div>

      <div className="report-disclaimer">
        Relatório gerado automaticamente pela AGRYN com base nos dados registrados na conta. As
        zonas de manejo indicam o vigor relativo por área e não substituem laudo técnico de
        engenheiro(a) agrônomo(a) responsável; doses de adubo por zona só são geradas com análise
        de solo vinculada. A recomendação final deve considerar textura do solo, histórico de
        produtividade, condições climáticas e legislação aplicável.
      </div>
    </article>
  );
}
