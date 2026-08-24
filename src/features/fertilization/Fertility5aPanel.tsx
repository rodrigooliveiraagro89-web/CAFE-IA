import { Check, Download, FlaskConical, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  converterFertilizantes,
  recomendarNutrientes5a,
  type Fase,
} from "../../domain/coffeeFertility5a";
import { CENARIOS, type CenarioId } from "../../domain/fertilization";
import { parseNumberBR } from "../../domain/parseNumber";
import { BarChart } from "../reports/charts/BarChart";
import type { SoilAnalysis } from "../soil/soilStore";
import {
  listRecommendations,
  saveRecommendation,
  type SavedRecommendation,
} from "./fert5aClient";

/**
 * Painel enxuto da 5ª Aproximação: o produtor só escolhe a FASE e a PRODUÇÃO
 * (cards Baixa/Média/Alta). Todos os valores vêm do laudo do talhão — o que não
 * houver fica nulo (sem calcular, com aviso). Referências técnicas: 5ª
 * Aproximação de Minas Gerais + Manual do Café (Emater-MG).
 */

type Props = {
  analysis: SoilAnalysis | null;
  plotName?: string;
  plotId?: string;
  // Cenário de produção controlado pelo módulo (sincroniza com o Boletim 100).
  cenario: CenarioId;
  onCenarioChange: (id: CenarioId) => void;
};

const FASES: { id: Fase; label: string }[] = [
  { id: "producao", label: "Lavoura em produção" },
  { id: "formacao_1_ano", label: "Formação — 1º ano" },
  { id: "formacao_2_ano", label: "Formação — 2º ano" },
  { id: "recepado_1_ano", label: "Recepa — 1º ano" },
  { id: "esqueletado_1_ano", label: "Esqueletamento — 1º ano" },
  { id: "implantacao", label: "Implantação" },
  { id: "pos_plantio", label: "Pós-plantio" },
];

const CLASSE_LABEL: Record<string, string> = {
  muito_baixo: "Muito baixo",
  baixo: "Baixo",
  medio: "Médio",
  bom: "Bom",
  muito_bom: "Muito bom",
  adequado: "Adequado",
  alto: "Alto",
};

function fmt(value: number | null, digits = 1): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("pt-BR", { maximumFractionDigits: digits });
}

const ESCALA_GERAL = ["muito_baixo", "baixo", "medio", "bom", "muito_bom"];
const ESCALA_GERAL_LABEL = ["M. baixo", "Baixo", "Médio", "Bom", "M. bom"];
const ESCALA_MICRO = ["baixo", "medio", "adequado", "alto"];
const ESCALA_MICRO_LABEL = ["Baixo", "Médio", "Adeq.", "Alto"];

// Cor por classe: baixo → vermelho, médio → âmbar, resto → verde.
function corClasse(classe: string): "danger" | "warning" | "success" {
  if (classe === "muito_baixo" || classe === "baixo") return "danger";
  if (classe === "medio") return "warning";
  return "success";
}

function ClassStrip({ escala, classe }: { escala: "geral" | "micro"; classe: string }) {
  const order = escala === "geral" ? ESCALA_GERAL : ESCALA_MICRO;
  const labels = escala === "geral" ? ESCALA_GERAL_LABEL : ESCALA_MICRO_LABEL;
  const idx = order.indexOf(classe);
  return (
    <div className="class-strip" data-cor={corClasse(classe)}>
      {order.map((o, i) => (
        <span key={o} className="class-cell" data-active={i === idx}>
          {labels[i]}
        </span>
      ))}
    </div>
  );
}

export function Fertility5aPanel({ analysis, plotName, plotId, cenario, onCenarioChange }: Props) {
  const v = analysis?.values;
  const [fase, setFase] = useState<Fase>("producao");
  const [safraAnt, setSafraAnt] = useState("");
  const [history, setHistory] = useState<SavedRecommendation[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  useEffect(() => {
    if (!plotId) return;
    let active = true;
    void listRecommendations(plotId).then((rows) => {
      if (active) setHistory(rows);
    });
    return () => {
      active = false;
    };
  }, [plotId]);

  // Todos os valores vêm do laudo. Ca/Mg em mmolc → cmolc; H+Al e Al são
  // derivados de CTC/V/m% quando o laudo não os traz explicitamente.
  const solo = useMemo(() => {
    const caC = v?.ca != null ? v.ca / 10 : null;
    const mgC = v?.mg != null ? v.mg / 10 : null;
    const kC = v?.k != null ? v.k / 391 : null;
    const sb = caC != null && mgC != null && kC != null ? caC + mgC + kC : null;
    const hAl = v?.hAl ?? (sb != null && v?.ctc != null ? Math.max(0, v.ctc - sb) : null);
    const mPct = v?.mPercent ?? null;
    const al = v?.al ?? (sb != null && mPct != null && mPct < 100 ? (mPct * sb) / (100 - mPct) : null);
    return {
      pH_agua: v?.ph ?? null,
      materia_organica_dag_kg: v?.organicMatter ?? null,
      P_mg_dm3: v?.p ?? null,
      P_rem_mg_L: v?.pRem ?? null,
      argila_percentual: v?.argila ?? null,
      K_mg_dm3: v?.k ?? null,
      Ca_cmolc_dm3: caC,
      Mg_cmolc_dm3: mgC,
      Al_cmolc_dm3: al,
      H_Al_cmolc_dm3: hAl,
      S_mg_dm3: v?.s ?? null,
      B_mg_dm3: v?.b ?? null,
      extrator_B: v?.extratorB ?? null,
      Cu_mg_dm3: v?.cu ?? null,
      extrator_Cu: v?.extratorMicros ?? null,
      Mn_mg_dm3: v?.mn ?? null,
      extrator_Mn: v?.extratorMicros ?? null,
      Zn_mg_dm3: v?.zn ?? null,
      extrator_Zn: v?.extratorMicros ?? null,
    };
  }, [v]);

  const prod = CENARIOS.find((c) => c.id === cenario)?.sacasPorHectare ?? 45;

  const rec = useMemo(
    () =>
      recomendarNutrientes5a({
        lavoura: {
          fase,
          produtividade_esperada_sc_ha: prod,
          produtividade_safra_anterior_sc_ha: parseNumberBR(safraAnt),
          PRNT_percentual: 95,
        },
        solo,
      }),
    [fase, prod, safraAnt, solo],
  );

  const c = rec.classificacoes;
  const n = rec.necessidade_nutrientes;
  const fertilizantes = converterFertilizantes(n);
  const hoje = new Date().toLocaleDateString("pt-BR");

  // Gráfico 1 — doses de macronutrientes (kg/ha).
  const dosesChart = (
    [
      { label: "N", value: n.N_kg_ha_ano },
      { label: "P₂O₅", value: n.P2O5_kg_ha_ano },
      { label: "K₂O", value: n.K2O_kg_ha_ano },
      { label: "S", value: n.S_kg_ha_ano },
    ] as { label: string; value: number | null }[]
  )
    .filter((d) => typeof d.value === "number" && d.value > 0)
    .map((d) => ({ label: d.label, value: d.value as number }));

  // Interpretação do solo — teor + classe (régua Muito baixo→Muito bom).
  const soilRows = (
    [
      { nome: "M.O.", valor: v?.organicMatter, unidade: "dag/kg", classe: c.materia_organica, escala: "geral" as const },
      { nome: "Ca", valor: solo.Ca_cmolc_dm3, unidade: "cmolc", classe: c.Ca, escala: "geral" as const },
      { nome: "Mg", valor: solo.Mg_cmolc_dm3, unidade: "cmolc", classe: c.Mg, escala: "geral" as const },
      { nome: "V", valor: rec.indices.V_percentual, unidade: "%", classe: c.V, escala: "geral" as const },
      { nome: "P", valor: solo.P_mg_dm3, unidade: "mg/dm³", classe: c.P, escala: "geral" as const },
      { nome: "S", valor: solo.S_mg_dm3, unidade: "mg/dm³", classe: c.S, escala: "geral" as const },
      { nome: "B", valor: v?.b, unidade: "mg/dm³", classe: c.B, escala: "micro" as const },
      { nome: "Cu", valor: v?.cu, unidade: "mg/dm³", classe: c.Cu, escala: "micro" as const },
      { nome: "Mn", valor: v?.mn, unidade: "mg/dm³", classe: c.Mn, escala: "micro" as const },
      { nome: "Zn", valor: v?.zn, unidade: "mg/dm³", classe: c.Zn, escala: "micro" as const },
    ] as { nome: string; valor: number | null | undefined; unidade: string; classe: string | null; escala: "geral" | "micro" }[]
  ).filter((r) => typeof r.valor === "number" && r.classe);

  // Gráfico 2 — participação das bases na CTC (%): Ca, Mg, K e H+Al.
  const T = rec.indices.T;
  const SB = rec.indices.SB;
  const K = rec.indices.K_cmolc_dm3;
  const participacaoChart =
    T && T > 0
      ? [
          { label: "Ca", value: (100 * (solo.Ca_cmolc_dm3 ?? 0)) / T },
          { label: "Mg", value: (100 * (solo.Mg_cmolc_dm3 ?? 0)) / T },
          { label: "K", value: (100 * (K ?? 0)) / T },
          { label: "H+Al", value: (100 * Math.max(0, T - (SB ?? 0))) / T },
        ].map((d) => ({ label: d.label, value: Math.round(d.value * 10) / 10 }))
      : [];

  async function salvar() {
    if (!plotId) return;
    setSaving(true);
    setSavedMsg("");
    const saved = await saveRecommendation(plotId, rec);
    setSaving(false);
    if (saved) {
      setHistory((prev) => [saved, ...prev].slice(0, 10));
      setSavedMsg("Recomendação salva no histórico do talhão.");
    } else {
      setSavedMsg("Não foi possível salvar. Tente novamente.");
    }
  }

  function baixarPdf() {
    document.body.classList.add("printing-fert5a");
    const limpar = () => {
      document.body.classList.remove("printing-fert5a");
      window.removeEventListener("afterprint", limpar);
    };
    window.addEventListener("afterprint", limpar);
    window.print();
    window.setTimeout(limpar, 1000);
  }

  if (!analysis) {
    return (
      <section className="panel-card fert5a">
        <div className="panel-title">
          <FlaskConical size={20} />
          <div>
            <span className="eyebrow">5ª Aproximação — MG (Emater)</span>
            <h2>Recomendação de nutrientes</h2>
          </div>
        </div>
        <p className="fert5a-hint">
          Envie a análise de solo do talhão {plotName ? `(${plotName})` : ""} para calcular pela 5ª
          Aproximação. Aí é só escolher a fase e a produção.
        </p>
      </section>
    );
  }

  return (
    <section className="panel-card fert5a fert5a-print-area">
      <div className="panel-title">
        <FlaskConical size={20} />
        <div>
          <span className="eyebrow">5ª Aproximação — MG (Emater)</span>
          <h2>Recomendação de nutrientes {plotName ? `· ${plotName}` : ""}</h2>
          <small className="fert5a-print-date">Emitido em {hoje}</small>
        </div>
        <div className="fert5a-actions no-print">
          {plotId && (
            <button className="secondary-button" type="button" onClick={() => void salvar()} disabled={saving}>
              <Save size={16} aria-hidden="true" /> {saving ? "Salvando…" : "Salvar"}
            </button>
          )}
          <button className="secondary-button" type="button" onClick={baixarPdf}>
            <Download size={16} aria-hidden="true" /> PDF
          </button>
        </div>
      </div>
      {savedMsg && <p className="fert5a-saved no-print"><Check size={14} /> {savedMsg}</p>}

      {/* Só duas escolhas: fase e produção. O resto vem do laudo. */}
      <div className="fert5a-escolhas no-print">
        <label className="fert5a-fase">
          Fase da lavoura
          <select value={fase} onChange={(e) => setFase(e.target.value as Fase)}>
            {FASES.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
        </label>
        <div className="fert5a-prod">
          <span className="fert5a-prod-label">Produção esperada</span>
          <div className="fert5a-cenarios">
            {CENARIOS.map((cen) => (
              <button
                key={cen.id}
                type="button"
                data-active={cen.id === cenario}
                onClick={() => onCenarioChange(cen.id)}
              >
                <strong>{cen.label}</strong>
                <small>{cen.sacasPorHectare} sc/ha</small>
              </button>
            ))}
          </div>
        </div>
        <label className="fert5a-safra">
          Safra passada (sc/ha) <span className="fert5a-opt">média/bienalidade</span>
          <input
            inputMode="decimal"
            value={safraAnt}
            onChange={(e) => setSafraAnt(e.target.value)}
            placeholder="opcional"
          />
        </label>
      </div>
      {rec.produtividade_calculo_sc_ha !== null && rec.produtividade_calculo_sc_ha !== prod && (
        <p className="fert5a-media no-print">
          Bienalidade: cálculo usando a <strong>média {fmt(rec.produtividade_calculo_sc_ha, 0)} sc/ha</strong>{" "}
          (ano de baixa &lt; 50% da safra passada).
        </p>
      )}

      <div className="fert5a-indices">
        <span><small>V</small><strong>{fmt(rec.indices.V_percentual)}%</strong></span>
        <span><small>m</small><strong>{fmt(rec.indices.m_percentual)}%</strong></span>
        <span><small>CTC (T)</small><strong>{fmt(rec.indices.T, 2)}</strong></span>
        <span><small>SB</small><strong>{fmt(rec.indices.SB, 2)}</strong></span>
      </div>

      <div className="fert5a-results">
        <div className="fert5a-doses">
          <h3>Necessidade de nutrientes</h3>
          <table>
            <tbody>
              <tr><td>N</td><td>{fmt(n.N_kg_ha_ano)} kg/ha·ano</td></tr>
              <tr><td>P₂O₅</td><td>{fmt(n.P2O5_kg_ha_ano)} kg/ha·ano <em>({CLASSE_LABEL[c.P ?? ""] ?? "—"})</em></td></tr>
              <tr><td>K₂O</td><td>{fmt(n.K2O_kg_ha_ano)} kg/ha·ano</td></tr>
              <tr><td>S</td><td>{fmt(n.S_kg_ha_ano)} kg/ha·ano <em>({CLASSE_LABEL[c.S ?? ""] ?? "—"})</em></td></tr>
              <tr><td>B</td><td>{fmt(n.B_kg_ha)} kg/ha <em>({CLASSE_LABEL[c.B ?? ""] ?? "—"})</em></td></tr>
              <tr><td>Cu</td><td>{fmt(n.Cu_kg_ha)} kg/ha <em>({CLASSE_LABEL[c.Cu ?? ""] ?? "—"})</em></td></tr>
              <tr><td>Mn</td><td>{fmt(n.Mn_kg_ha)} kg/ha <em>({CLASSE_LABEL[c.Mn ?? ""] ?? "—"})</em></td></tr>
              <tr><td>Zn</td><td>{fmt(n.Zn_kg_ha)} kg/ha <em>({CLASSE_LABEL[c.Zn ?? ""] ?? "—"})</em></td></tr>
            </tbody>
          </table>
        </div>
        <div className="fert5a-correcao">
          <h3>Correção do solo</h3>
          <p>
            <strong>Calagem:</strong>{" "}
            {rec.correcao_solo.calagem_t_ha_produto !== null
              ? `${fmt(rec.correcao_solo.calagem_t_ha_produto, 2)} t/ha (produto) · ${fmt(rec.correcao_solo.calagem_t_ha_prnt100, 2)} t/ha PRNT 100%`
              : "sem dados de Ca/Mg/Al/H+Al no laudo"}
          </p>
          <p>
            <strong>Gessagem:</strong>{" "}
            {rec.correcao_solo.gessagem_indicada
              ? "indicada (avaliar 20–40 cm)"
              : "não indicada pelos dados atuais"}
          </p>
        </div>
      </div>

      {soilRows.length > 0 && (
        <div className="fert5a-interpret">
          <h3>Interpretação do solo (teor × faixa)</h3>
          <div className="interpret-rows">
            {soilRows.map((r) => (
              <div className="interpret-row" key={r.nome}>
                <span className="interpret-nome">{r.nome}</span>
                <span className="interpret-valor">
                  {fmt(r.valor as number, 2)} <em>{r.unidade}</em>
                </span>
                <ClassStrip escala={r.escala} classe={r.classe as string} />
              </div>
            ))}
          </div>
        </div>
      )}

      {(dosesChart.length > 0 || participacaoChart.length > 0) && (
        <div className="fert5a-charts">
          {dosesChart.length > 0 && (
            <div className="fert5a-chart">
              <h3>Doses de macronutrientes (kg/ha·ano)</h3>
              <BarChart
                data={dosesChart}
                formatValue={(x) => `${x.toLocaleString("pt-BR")} kg`}
                color="var(--agryn-emerald, #22c55e)"
              />
            </div>
          )}
          {participacaoChart.length > 0 && (
            <div className="fert5a-chart">
              <h3>Participação das bases na CTC (%)</h3>
              <BarChart
                data={participacaoChart}
                formatValue={(x) => `${x.toLocaleString("pt-BR")}%`}
                color="var(--info, #2563eb)"
              />
            </div>
          )}
        </div>
      )}

      {fertilizantes.length > 0 && (
        <div className="fert5a-fertilizantes">
          <h3>Sugestão de fertilizantes (kg/ha)</h3>
          <table>
            <tbody>
              {fertilizantes.map((item) => (
                <tr key={item.produto}>
                  <td><strong>{item.produto}</strong> <em>{item.formula}</em></td>
                  <td className="fert5a-kg">{fmt(item.kg_ha, 0)} kg/ha</td>
                  <td className="fert5a-obs">{item.obs ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="fert5a-parcelamento">
            Parcele o N e o K em 3–4 vezes de outubro a março. Uma fonte é só uma opção — o
            responsável técnico pode trocar por outro formulado equivalente.
          </p>
        </div>
      )}

      {rec.alertas.length > 0 && (
        <details className="fert5a-alertas no-print">
          <summary>Observações e travas de segurança ({rec.alertas.length})</summary>
          <ul>
            {rec.alertas.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </details>
      )}
      <p className="fert5a-fonte">
        Fonte: 5ª Aproximação de Minas Gerais + Manual do Café (Emater-MG). Valores do laudo; o que
        não estiver no laudo fica em branco. Decisão final e conversão em fertilizante são do
        responsável técnico.
      </p>

      {history.length > 0 && (
        <div className="fert5a-history no-print">
          <h3>Recomendações salvas</h3>
          <ul>
            {history.map((h) => {
              const nn = h.payload?.necessidade_nutrientes;
              const data = new Date(h.createdAt).toLocaleDateString("pt-BR");
              return (
                <li key={h.id}>
                  <strong>{data}</strong>
                  <span>
                    {h.produtividadeSc ? `${fmt(h.produtividadeSc, 0)} sc/ha · ` : ""}
                    N {fmt(nn?.N_kg_ha_ano ?? null, 0)} · P₂O₅ {fmt(nn?.P2O5_kg_ha_ano ?? null, 0)} ·
                    K₂O {fmt(nn?.K2O_kg_ha_ano ?? null, 0)} kg/ha
                    {h.payload?.correcao_solo?.calagem_t_ha_produto
                      ? ` · calc. ${fmt(h.payload.correcao_solo.calagem_t_ha_produto, 2)} t/ha`
                      : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
