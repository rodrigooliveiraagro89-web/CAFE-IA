import { useEffect, useState } from "react";
import {
  ArrowRight,
  Beaker,
  CircleDollarSign,
  Download,
  FlaskConical,
  Info,
  Layers,
  Mountain,
  ShieldCheck,
  Sprout,
  TriangleAlert,
} from "lucide-react";
import type { AppView } from "../../app/navigation";
import {
  CENARIOS,
  calcularCalagem,
  recomendarAdubacao,
  sacasParaKgHa,
  type CenarioId,
} from "../../domain/fertilization";
import {
  FONTES_K,
  FONTES_P,
  FORMULAS_COBERTURA,
  PRECO_PADRAO_KG,
  custoPorHectare,
  montarPrograma,
} from "../../domain/fertilizerProgram";
import { gramasPorPlanta } from "../../domain/calculators";
import { buildProveniencia, provenienciaResumo } from "../../domain/provenance";
import { shortHash, type RecommendationSnapshot } from "../../domain/recommendationSnapshot";
import { BarChart } from "../reports/charts/BarChart";
import {
  listSnapshots,
  saveSnapshot,
  type SavedSnapshot,
  type SnapshotListItem,
} from "./snapshotClient";
import { parseNumberBR } from "../../domain/parseNumber";
import {
  VR_LIMITACAO_GEO,
  ZONA_EXCLUIDA_NOTA,
  construirPrescricaoVR,
  prescricaoParaCsv,
} from "../../domain/variableRate";
import type { AgriculturalController } from "../../lib/useAgriculturalContext";
import { buildManagementZones } from "../ndvi/managementZones";
import type { NdviResult } from "../ndvi/types";
import type { SoilAnalysis } from "../soil/soilStore";
import { Fertility5aPanel } from "./Fertility5aPanel";
import "./fertilization.css";

type FertilizationModuleProps = {
  agriculture: AgriculturalController;
  soilAnalyses: SoilAnalysis[];
  ndviHistory: NdviResult[];
  onNavigate: (view: AppView) => void;
};

type FertPrefs = {
  cenarioId?: CenarioId;
  plantas?: string;
  vAlvo?: number;
  fonteP?: string;
  cobertura?: string;
  fonteK?: string;
};

function loadFertPrefs(plotId?: string | null): FertPrefs | null {
  if (!plotId || typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(`agryn.fert.${plotId}`);
    return raw ? (JSON.parse(raw) as FertPrefs) : null;
  } catch {
    return null;
  }
}

const brl0 = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const brl2 = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PRECOS_KEY = "agryn.fert.precos";

// Preços por kg (R$), editáveis e guardados globais — não dependem do talhão.
function loadPrecos(): Record<string, string> {
  const base: Record<string, string> = {};
  for (const [id, valor] of Object.entries(PRECO_PADRAO_KG)) {
    base[id] = String(valor).replace(".", ",");
  }
  if (typeof localStorage === "undefined") return base;
  try {
    const raw = localStorage.getItem(PRECOS_KEY);
    if (raw) Object.assign(base, JSON.parse(raw) as Record<string, string>);
  } catch {
    // usa os padrões
  }
  return base;
}

function latestNdviForPlot(history: NdviResult[], plotId: string): NdviResult | null {
  const matches = history
    .filter((item) => item.plotId === plotId)
    .sort((a, b) => new Date(b.acquiredAt).getTime() - new Date(a.acquiredAt).getTime());
  return matches[0] ?? null;
}

function baixarCsv(conteudo: string, nomeArquivo: string) {
  const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  link.click();
  URL.revokeObjectURL(url);
}

const nf = (value: number, digits = 0) =>
  value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

function latestSoilForPlot(analyses: SoilAnalysis[], plotId: string): SoilAnalysis | null {
  const matches = analyses
    .filter((item) => item.plotId === plotId)
    .sort(
      (a, b) =>
        new Date(b.analysisDate ?? b.createdAt).getTime() -
        new Date(a.analysisDate ?? a.createdAt).getTime(),
    );
  return matches[0] ?? null;
}

export function FertilizationModule({
  agriculture,
  soilAnalyses,
  ndviHistory,
  onNavigate,
}: FertilizationModuleProps) {
  // Preferências salvas por talhão (localStorage). Lidas no init; o componente
  // remonta ao trocar de talhão (key no App), então o init reflete o talhão atual.
  const savedPrefs = loadFertPrefs(agriculture.selectedPlot?.id);
  const [cenarioId, setCenarioId] = useState<CenarioId>(savedPrefs?.cenarioId ?? "media");
  const [plantasPorHaRaw, setPlantasPorHaRaw] = useState(savedPrefs?.plantas ?? "4082");
  const [vAlvo, setVAlvo] = useState<number>(savedPrefs?.vAlvo ?? 60);
  const [fonteP, setFonteP] = useState(savedPrefs?.fonteP ?? "map");
  const [cobertura, setCobertura] = useState(savedPrefs?.cobertura ?? "270010");
  const [fonteK, setFonteK] = useState(savedPrefs?.fonteK ?? "kcl");
  const [precos, setPrecos] = useState<Record<string, string>>(loadPrecos);
  const [emitindo, setEmitindo] = useState(false);
  const [emitido, setEmitido] = useState<SavedSnapshot | null>(null);
  const [erroEmissao, setErroEmissao] = useState<string | null>(null);
  const [emissoes, setEmissoes] = useState<SnapshotListItem[]>([]);
  const plantasPorHa = parseNumberBR(plantasPorHaRaw) ?? 0;
  const plantasPorHaInvalido = plantasPorHaRaw.trim() !== "" && parseNumberBR(plantasPorHaRaw) === null;

  const plot = agriculture.selectedPlot;

  // Salva a recomendação escolhida deste talhão (persiste entre acessos).
  useEffect(() => {
    if (!plot) return;
    try {
      localStorage.setItem(
        `agryn.fert.${plot.id}`,
        JSON.stringify({ cenarioId, plantas: plantasPorHaRaw, vAlvo, fonteP, cobertura, fonteK }),
      );
    } catch {
      // Sem espaço/modo privativo: segue só em memória nesta sessão.
    }
  }, [plot, cenarioId, plantasPorHaRaw, vAlvo, fonteP, cobertura, fonteK]);

  // Preços são globais (não do talhão) — guardados à parte.
  useEffect(() => {
    try {
      localStorage.setItem(PRECOS_KEY, JSON.stringify(precos));
    } catch {
      // sem persistência: segue em memória
    }
  }, [precos]);

  // Carrega o histórico de emissões (snapshots) deste talhão.
  useEffect(() => {
    if (!plot) return;
    let active = true;
    void listSnapshots(plot.id).then((list) => {
      if (active) setEmissoes(list);
    });
    return () => {
      active = false;
    };
  }, [plot]);
  const soil = plot ? latestSoilForPlot(soilAnalyses, plot.id) : null;
  const cenario = CENARIOS.find((item) => item.id === cenarioId) ?? CENARIOS[1];

  if (!plot) {
    return (
      <div className="page-stack platform-page">
        <header className="page-header">
          <div>
            <span className="eyebrow">Manejo nutricional</span>
            <h1>Calagem e adubação</h1>
          </div>
        </header>
        <section className="empty-state context-empty">
          <Sprout size={31} />
          <h2>Selecione um talhão</h2>
          <p>A recomendação é calculada para a área e o laudo de um talhão específico.</p>
          <button type="button" onClick={() => onNavigate("propriedades")}>
            Selecionar talhão
          </button>
        </section>
      </div>
    );
  }

  const values = soil?.values ?? {};
  const produtividadeKgHa = sacasParaKgHa(cenario.sacasPorHectare);

  const calagem =
    values.ctc !== null && values.ctc !== undefined &&
    values.vPercent !== null && values.vPercent !== undefined
      ? calcularCalagem({ ctcCmolc: values.ctc, vAtual: values.vPercent, vAlvo })
      : null;

  const adubacao = recomendarAdubacao({
    produtividadeKgHa,
    pResina: values.p,
    kMgPorDm3: values.k,
    sMgPorDm3: values.s,
  });

  const programa = montarPrograma(
    { n: adubacao.n, p2o5: adubacao.p2o5, k2o: adubacao.k2o },
    { fonteP, cobertura, fonteK },
  );

  const precosNum: Record<string, number> = {};
  for (const [id, raw] of Object.entries(precos)) {
    precosNum[id] = parseNumberBR(raw) ?? 0;
  }

  // Proveniência: qual laudo + base + parâmetros geraram esta recomendação.
  const proveniencia = buildProveniencia(
    soil ? { id: soil.id, data: soil.analysisDate, laboratorio: soil.laboratory, origem: soil.source } : null,
    { vAlvo, cobertura, fonteP, fonteK, sacas: cenario.sacasPorHectare, plantasPorHa },
  );


  // Custo do programa em cada cenário (a fórmula é a mesma; as doses mudam).
  const custoPorCenario = CENARIOS.map((item) => {
    const adub = recomendarAdubacao({
      produtividadeKgHa: sacasParaKgHa(item.sacasPorHectare),
      pResina: values.p,
      kMgPorDm3: values.k,
      sMgPorDm3: values.s,
    });
    const prog = montarPrograma(
      { n: adub.n, p2o5: adub.p2o5, k2o: adub.k2o },
      { fonteP, cobertura, fonteK },
    );
    const custoHa = custoPorHectare(prog, precosNum);
    return {
      id: item.id,
      label: item.label,
      sacas: item.sacasPorHectare,
      custoHa,
      custoSaca: item.sacasPorHectare > 0 ? custoHa / item.sacasPorHectare : 0,
    };
  });

  const custoAtual = custoPorCenario.find((item) => item.id === cenarioId);

  async function emitirRecomendacao() {
    if (!plot) return;
    setEmitindo(true);
    setErroEmissao(null);
    const snap: RecommendationSnapshot = {
      plotId: plot.id,
      soilAnalysisId: soil?.id ?? null,
      engine: proveniencia.engine,
      version: proveniencia.versao,
      params: { vAlvo, cobertura, fonteP, fonteK, sacas: cenario.sacasPorHectare, plantasPorHa },
      npk: { n: adubacao.n, p2o5: adubacao.p2o5, k2o: adubacao.k2o, s: adubacao.s },
      calagemTHa: calagem?.toneladasPorHectare ?? 0,
      programa: programa.itens.map((it) => ({
        id: it.id,
        formula: it.formula,
        kgPorHectare: Math.round(it.kgPorHectare * 100) / 100,
      })),
      custoHa: Math.round((custoAtual?.custoHa ?? 0) * 100) / 100,
      custoSaca: Math.round((custoAtual?.custoSaca ?? 0) * 100) / 100,
    };
    const result = await saveSnapshot(snap);
    if (result.ok) {
      setEmitido(result.saved);
      setEmissoes((prev) => [
        { id: result.saved.id, hash: result.saved.hash, createdAt: result.saved.createdAt, cobertura, custoSaca: snap.custoSaca },
        ...prev,
      ]);
    } else {
      setErroEmissao(result.reason);
    }
    setEmitindo(false);
  }

  const totalCalcario = calagem ? calagem.toneladasPorHectare * plot.areaHectares : 0;

  const nutrientes = [
    { label: "Nitrogênio (N)", value: adubacao.n },
    { label: "Fósforo (P₂O₅)", value: adubacao.p2o5 },
    { label: "Potássio (K₂O)", value: adubacao.k2o },
    { label: "Enxofre (S)", value: adubacao.s },
  ];

  return (
    <div className="page-stack platform-page">
      <header className="page-header context-page-header">
        <div>
          <span className="eyebrow">Manejo nutricional · 5ª Aproximação MG (Emater)</span>
          <h1>Calagem e adubação</h1>
          <p>
            Recomendação pela 5ª Aproximação de Minas Gerais a partir do laudo do talhão e da
            produtividade esperada. Abaixo, o programa alternativo pelo Boletim 100 (IAC).
          </p>
        </div>
        <button className="secondary-button" type="button" onClick={() => onNavigate("analise-solo")}>
          Ver laudo <ArrowRight size={17} />
        </button>
      </header>

      {!soil && (
        <section className="fert-warning">
          <TriangleAlert size={19} aria-hidden="true" />
          <div>
            <strong>Sem laudo de solo para {plot.name}</strong>
            <p>
              As doses abaixo usam as classes médias do Boletim 100. Envie o laudo para uma
              recomendação baseada no seu solo.
            </p>
            <button type="button" onClick={() => onNavigate("analise-solo")}>
              <FlaskConical size={16} /> Enviar laudo
            </button>
          </div>
        </section>
      )}

      <Fertility5aPanel analysis={soil} plotName={plot.name} plotId={plot.id} />

      <section className="panel-card">
        <div className="panel-title">
          <Sprout size={21} />
          <div>
            <span className="eyebrow">{plot.name} · {nf(plot.areaHectares, 2)} ha</span>
            <h2>Produtividade esperada</h2>
          </div>
        </div>

        <div className="fert-scenarios" role="group" aria-label="Cenário de produtividade">
          {CENARIOS.map((item) => (
            <button
              key={item.id}
              type="button"
              data-active={item.id === cenarioId}
              onClick={() => setCenarioId(item.id)}
            >
              <strong>{item.label}</strong>
              <span>{item.sacasPorHectare} sc/ha</span>
            </button>
          ))}
        </div>
        <p className="fert-hint">
          {nf(produtividadeKgHa)} kg/ha de café beneficiado. Na dúvida, o Boletim 100 orienta
          errar um pouco para mais — faltar adubo em ano bom custa mais caro.
        </p>
      </section>

      <section className="panel-card">
        <div className="panel-title">
          <Mountain size={21} />
          <div>
            <span className="eyebrow">Correção</span>
            <h2>Calagem</h2>
          </div>
        </div>

        {calagem && (
          <div className="fert-slider">
            <div className="fert-slider-head">
              <span>Saturação por bases desejada (V₂)</span>
              <strong>{vAlvo}%</strong>
            </div>
            <input
              type="range"
              min={40}
              max={80}
              step={1}
              value={vAlvo}
              aria-label="Alvo de V%"
              onChange={(event) => setVAlvo(Number(event.target.value))}
              style={{ ["--pct" as string]: `${((vAlvo - 40) / 40) * 100}%` }}
            />
            <small>Café: alvo usual 60%. Mova para simular a dose de calcário.</small>
          </div>
        )}

        {!calagem ? (
          <p className="fert-empty">
            Precisa de <strong>CTC</strong> e <strong>V%</strong> no laudo para calcular a
            necessidade de calcário.
          </p>
        ) : calagem.dispensada ? (
          <p className="fert-ok">
            V% atual de {nf(calagem.vAtual, 1)}% já atingiu o alvo de {calagem.vAlvo}% —
            calagem dispensada nesta safra.
          </p>
        ) : (
          <>
            <div className="calc-results">
              <div>
                <span>Calcário dolomítico</span>
                <strong>{nf(calagem.toneladasPorHectare, 2)}</strong>
                <small>t/ha (PRNT {calagem.prnt}%)</small>
              </div>
              <div>
                <span>Total no talhão</span>
                <strong>{nf(totalCalcario, 2)}</strong>
                <small>toneladas</small>
              </div>
              <div>
                <span>Saturação por bases</span>
                <strong>{nf(calagem.vAtual, 1)}% → {calagem.vAlvo}%</strong>
                <small>V% atual → alvo</small>
              </div>
            </div>
            <p className="fert-hint">
              Aplicar a lanço na entrelinha, idealmente 60–90 dias antes da adubação, para dar
              tempo de reação no solo.
            </p>
          </>
        )}
      </section>

      <section className="panel-card">
        <div className="panel-title">
          <FlaskConical size={21} />
          <div>
            <span className="eyebrow">Boletim 100</span>
            <h2>Adubação NPK</h2>
          </div>
        </div>

        <div className="fert-npk">
          {nutrientes.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{nf(item.value)}</strong>
              <small>kg/ha</small>
              {plantasPorHa > 0 && item.value > 0 && (
                <em>{nf(gramasPorPlanta(item.value, plantasPorHa) ?? 0, 1)} g/planta</em>
              )}
            </div>
          ))}
        </div>

        <div className="fert-chart fert-chart--npk">
          <h3>N-P₂O₅-K₂O — cenário {cenario.label} ({cenario.sacasPorHectare} sc/ha)</h3>
          <BarChart
            data={[
              { label: "N", value: adubacao.n },
              { label: "P₂O₅", value: adubacao.p2o5 },
              { label: "K₂O", value: adubacao.k2o },
              { label: "S", value: adubacao.s },
            ]}
            formatValue={(value) => `${nf(value)} kg/ha`}
            color="var(--success)"
          />
        </div>

        <label className="fert-stand">
          Plantas por hectare (para o cálculo de g/planta)
          <input
            type="text"
            inputMode="numeric"
            value={plantasPorHaRaw}
            aria-invalid={plantasPorHaInvalido}
            onChange={(event) => setPlantasPorHaRaw(event.target.value)}
          />
          {plantasPorHaInvalido && (
            <small className="field-invalid">Use apenas números (ex.: 4082)</small>
          )}
        </label>

        <p className="fert-hint">
          Parcele N e K em 3 a 4 aplicações ao longo das águas (out/nov → fev/mar). P e calagem
          podem ir de uma vez.
        </p>

        {adubacao.suposicoes.length > 0 && (
          <div className="fert-assumptions">
            <Info size={16} aria-hidden="true" />
            <div>
              <strong>Suposições feitas por falta de dado</strong>
              <ul>
                {adubacao.suposicoes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>

      <section className="panel-card">
        <div className="panel-title">
          <Beaker size={21} />
          <div>
            <span className="eyebrow">Programa · fórmulas de mercado</span>
            <h2>Escolha a fórmula</h2>
          </div>
        </div>

        <div className="fert-formula-grid">
          <label>
            Fonte de fósforo (P₂O₅)
            <select value={fonteP} onChange={(event) => setFonteP(event.target.value)}>
              {FONTES_P.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}{f.formula !== "—" ? ` (${f.formula})` : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fórmula de cobertura (N-K)
            <select value={cobertura} onChange={(event) => setCobertura(event.target.value)}>
              {FORMULAS_COBERTURA.map((f) => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
          </label>
          <label>
            Complemento de potássio
            <select value={fonteK} onChange={(event) => setFonteK(event.target.value)}>
              {FONTES_K.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}{f.formula !== "—" ? ` (${f.formula})` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        {programa.itens.length === 0 ? (
          <p className="fert-empty">Ajuste o cenário ou envie o laudo para gerar o programa.</p>
        ) : (
          <div className="fert-prog-wrap">
            <table className="fert-prog-table">
              <thead>
                <tr>
                  <th>Insumo</th>
                  <th>kg/ha</th>
                  {plantasPorHa > 0 && <th>g/planta</th>}
                </tr>
              </thead>
              <tbody>
                {programa.itens.map((item) => (
                  <tr key={item.formula + item.nome}>
                    <td>
                      <span className="fert-prog-name">{item.nome}</span>
                      <small>{item.formula}</small>
                    </td>
                    <td>{nf(item.kgPorHectare)}</td>
                    {plantasPorHa > 0 && (
                      <td>{nf(gramasPorPlanta(item.kgPorHectare, plantasPorHa) ?? 0)}</td>
                    )}
                  </tr>
                ))}
                <tr className="fert-prog-total">
                  <td>Total de adubo</td>
                  <td>{nf(programa.totalKgPorHectare)}</td>
                  {plantasPorHa > 0 && <td />}
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <p className="fert-hint">
          Entrega: N {nf(programa.entregue.n)} · P₂O₅ {nf(programa.entregue.p2o5)} · K₂O{" "}
          {nf(programa.entregue.k2o)} · S {nf(programa.entregue.s)} kg/ha — alvo N {nf(adubacao.n)} ·
          P₂O₅ {nf(adubacao.p2o5)} · K₂O {nf(adubacao.k2o)}.
        </p>

        {programa.entregue.k2o > adubacao.k2o * 1.3 + 1 && (
          <div className="fert-assumptions">
            <Info size={16} aria-hidden="true" />
            <div>
              <strong>Potássio em excesso</strong>
              <ul>
                <li>
                  A cobertura escolhida entrega bem mais K₂O do que o necessário. Com K alto no
                  solo, uma fórmula como <strong>27-00-10</strong> ou <strong>30-00-10</strong>{" "}
                  fecha melhor e economiza adubo.
                </li>
              </ul>
            </div>
          </div>
        )}

        <p className="fert-saved">
          ✓ Recomendação salva neste talhão — fórmula, V% e plantas/ha ficam guardados neste
          aparelho.
        </p>
      </section>

      <section className="panel-card">
        <div className="panel-title">
          <CircleDollarSign size={21} />
          <div>
            <span className="eyebrow">Custo estimado</span>
            <h2>Quanto custa a adubação</h2>
          </div>
        </div>
        <p className="fert-hint">
          Preço por kg de cada insumo (editável, guardado neste aparelho). O custo por saca usa a
          produtividade-alvo de cada cenário.
        </p>

        {programa.itens.length > 0 && (
          <div className="fert-price-grid">
            {programa.itens.map((item) => (
              <label key={item.id}>
                {item.nome} <small>{item.formula}</small>
                <span className="fert-price-input">
                  <span>R$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={precos[item.id] ?? ""}
                    onChange={(event) =>
                      setPrecos((prev) => ({ ...prev, [item.id]: event.target.value }))
                    }
                  />
                  <span>/kg</span>
                </span>
              </label>
            ))}
          </div>
        )}

        <div className="fert-prog-wrap">
          <table className="fert-prog-table">
            <thead>
              <tr>
                <th>Cenário</th>
                <th>R$/ha</th>
                <th>R$/saca</th>
              </tr>
            </thead>
            <tbody>
              {custoPorCenario.map((item) => (
                <tr key={item.id} data-active={item.id === cenarioId || undefined}>
                  <td>{item.label} · {item.sacas} sc/ha</td>
                  <td>{brl0(item.custoHa)}</td>
                  <td>{brl2(item.custoSaca)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="fert-charts">
          <div className="fert-chart">
            <h3>Custo por saca</h3>
            <BarChart
              data={custoPorCenario.map((item) => ({ label: item.label, value: item.custoSaca }))}
              formatValue={(value) => brl2(value)}
              color="var(--warning)"
            />
          </div>
          <div className="fert-chart">
            <h3>Custo por hectare</h3>
            <BarChart
              data={custoPorCenario.map((item) => ({ label: item.label, value: item.custoHa }))}
              formatValue={(value) => brl0(value)}
              color="var(--info)"
            />
          </div>
        </div>
      </section>

      {(() => {
        const ndvi = latestNdviForPlot(ndviHistory, plot.id);
        const zonas = ndvi ? buildManagementZones(ndvi).filter((z) => z.hectares > 0) : [];

        if (!soil || zonas.length === 0) {
          return (
            <section className="panel-card">
              <div className="panel-title">
                <Layers size={21} />
                <div>
                  <span className="eyebrow">Taxa variável</span>
                  <h2>Prescrição por zona</h2>
                </div>
              </div>
              <p className="fert-empty">
                Precisa de <strong>laudo de solo</strong> e de um{" "}
                <strong>processamento de NDVI</strong> neste talhão para modular a dose por
                zona.{" "}
                {!ndvi && (
                  <button
                    type="button"
                    className="ndvi-inline-link"
                    onClick={() => onNavigate("ndvi")}
                  >
                    Processar NDVI
                  </button>
                )}
              </p>
            </section>
          );
        }

        const prescricao = construirPrescricaoVR(zonas, {
          n: adubacao.n,
          p2o5: adubacao.p2o5,
          k2o: adubacao.k2o,
        });

        return (
          <section className="panel-card">
            <div className="panel-title">
              <Layers size={21} />
              <div>
                <span className="eyebrow">Taxa variável · zonas do NDVI</span>
                <h2>Prescrição por zona</h2>
              </div>
            </div>

            <div className="vr-table-wrap">
              <table className="vr-table">
                <thead>
                  <tr>
                    <th>Zona</th>
                    <th>Área</th>
                    <th>Fator</th>
                    <th>N</th>
                    <th>P₂O₅</th>
                    <th>K₂O</th>
                  </tr>
                </thead>
                <tbody>
                  {prescricao.zonas.map((zona) => (
                    <tr key={zona.letter} data-excluida={zona.excluida || undefined}>
                      <td>
                        <span className="vr-dot" style={{ background: zona.color }} />
                        {zona.letter} · {zona.label}
                      </td>
                      <td>{nf(zona.hectares, 2)} ha</td>
                      <td>{zona.excluida ? "—" : `${nf(zona.fator, 2)}×`}</td>
                      <td>{zona.excluida ? "não adubar" : `${nf(zona.dosePorHectare.n)} kg/ha`}</td>
                      <td>{zona.excluida ? "—" : `${nf(zona.dosePorHectare.p2o5)} kg/ha`}</td>
                      <td>{zona.excluida ? "—" : `${nf(zona.dosePorHectare.k2o)} kg/ha`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="calc-results">
              <div>
                <span>Total a taxa variável</span>
                <strong>{nf(prescricao.totalVariavel.n)}</strong>
                <small>kg de N ({nf(prescricao.hectaresAdubados, 2)} ha adubados)</small>
              </div>
              <div>
                <span>Se fosse dose única</span>
                <strong>{nf(prescricao.totalUniforme.n)}</strong>
                <small>kg de N em {nf(prescricao.hectaresTotais, 2)} ha</small>
              </div>
              <div>
                <span>{prescricao.economia.n >= 0 ? "Economia de N" : "Acréscimo de N"}</span>
                <strong>{nf(Math.abs(prescricao.economia.n))}</strong>
                <small>kg</small>
              </div>
            </div>

            <button
              type="button"
              className="secondary-button vr-export"
              onClick={() =>
                baixarCsv(
                  prescricaoParaCsv(prescricao),
                  `prescricao-vr-${plot.name.replace(/\s+/g, "-").toLowerCase()}.csv`,
                )
              }
            >
              <Download size={17} /> Baixar CSV da prescrição
            </button>

            <div className="fert-assumptions">
              <Info size={16} aria-hidden="true" />
              <div>
                <strong>Leia antes de aplicar</strong>
                <ul>
                  <li>{ZONA_EXCLUIDA_NOTA}</li>
                  <li>{VR_LIMITACAO_GEO}</li>
                </ul>
              </div>
            </div>
          </section>
        );
      })()}

      <section className="panel-card fert-prov">
        <div className="panel-title">
          <FlaskConical size={21} />
          <div>
            <span className="eyebrow">Rastreabilidade</span>
            <h2>Proveniência da recomendação</h2>
          </div>
        </div>
        <dl className="fert-prov-grid">
          <div>
            <dt>Laudo de origem</dt>
            <dd>
              {soil
                ? `${soil.laboratory ? soil.laboratory + " · " : ""}${
                    soil.analysisDate
                      ? new Date(`${soil.analysisDate}T12:00:00`).toLocaleDateString("pt-BR")
                      : "sem data"
                  } · ${soil.source === "pdf" ? "PDF" : soil.source === "foto" ? "foto" : "manual"}`
                : "Sem laudo — classes médias assumidas"}
            </dd>
          </div>
          <div>
            <dt>Base técnica</dt>
            <dd>{proveniencia.engine} · v{proveniencia.versao}</dd>
          </div>
          <div>
            <dt>Parâmetros</dt>
            <dd>
              V% alvo {vAlvo} · cobertura {cobertura} · {cenario.sacasPorHectare} sc/ha ·{" "}
              {plantasPorHa > 0 ? `${nf(plantasPorHa)} pl/ha` : "plantas/ha não informado"}
            </dd>
          </div>
          <div>
            <dt>Gerado em</dt>
            <dd>{new Date(proveniencia.geradoEm).toLocaleString("pt-BR")}</dd>
          </div>
        </dl>
        <p className="fert-prov-note">{provenienciaResumo(proveniencia)}</p>

        <div className="fert-emit">
          <button
            type="button"
            className="primary-button"
            onClick={() => void emitirRecomendacao()}
            disabled={emitindo}
          >
            <ShieldCheck size={16} aria-hidden="true" />
            {emitindo ? "Registrando…" : "Registrar recomendação (imutável)"}
          </button>
          {emitido && (
            <p className="fert-emit-ok">
              ✓ Emitida em {new Date(emitido.createdAt).toLocaleString("pt-BR")} · id{" "}
              {emitido.id.slice(0, 8)} · hash <code>{shortHash(emitido.hash)}</code>
            </p>
          )}
          {erroEmissao && <p className="fert-emit-erro">{erroEmissao}</p>}
        </div>

        {emissoes.length > 0 && (
          <details className="fert-emit-list">
            <summary>Emissões anteriores ({emissoes.length})</summary>
            <ul>
              {emissoes.map((item) => (
                <li key={item.id}>
                  <span>{new Date(item.createdAt).toLocaleDateString("pt-BR")}</span> · {item.cobertura} ·{" "}
                  {brl2(item.custoSaca)}/sc · <code>{shortHash(item.hash)}</code>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <p className="fert-disclaimer">
        Cálculo determinístico a partir das tabelas do Boletim 100 (IAC) e do laudo informado.
        Não substitui a visita e a assinatura do engenheiro agrônomo responsável, que deve
        validar a recomendação considerando histórico, textura do solo e condições da lavoura.
      </p>
    </div>
  );
}
