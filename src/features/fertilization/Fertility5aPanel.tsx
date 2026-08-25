import { Check, Download, FlaskConical, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  converterFertilizantes,
  cronogramaAdubacao,
  FASE_LABEL,
  recomendarNutrientes5a,
  sugerirFormulacao,
  type ExtratorB,
  type ExtratorMetalico,
  type Fase,
  type Sistema,
} from "../../domain/coffeeFertility5a";
import { CENARIOS, type CenarioId } from "../../domain/fertilization";
import { parseNumberBR } from "../../domain/parseNumber";
import { BarChart } from "../reports/charts/BarChart";
import { ClassStrip } from "./ClassStrip";
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
  // População efetiva do talhão (plantas/ha), quando derivável do cadastro.
  plantasHa?: number | null;
  // Área do talhão (ha), para dimensionar a formulação em kg totais e sacas.
  areaHa?: number | null;
  // Cenário de produção controlado pelo módulo (sincroniza os cards).
  cenario: CenarioId;
  onCenarioChange: (id: CenarioId) => void;
};

// Ordem de exibição das fases (o rótulo vem do motor, fonte única).
const FASE_ORDEM: Fase[] = [
  "producao",
  "formacao_1_ano",
  "formacao_2_ano",
  "recepado_1_ano",
  "esqueletado_1_ano",
  "implantacao",
  "pos_plantio",
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

// Complementos do laudo: o produtor preenche o que a extração não trouxe, para
// o motor não precisar assumir nada. Guardados por talhão (localStorage).
type Complementos = {
  pRem?: string;
  argila?: string;
  ph?: string;
  mo?: string;
  prnt?: string;
  foliarN?: string;
  extratorB?: ExtratorB | "";
  extratorMicros?: ExtratorMetalico | "";
  ca2040?: string;
  al2040?: string;
  m2040?: string;
};

const COMP_KEY = (plotId: string) => `agryn.fert5a.comp.${plotId}`;

function loadComplementos(plotId?: string): Complementos {
  if (!plotId || typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(COMP_KEY(plotId));
    return raw ? (JSON.parse(raw) as Complementos) : {};
  } catch {
    return {};
  }
}


export function Fertility5aPanel({ analysis, plotName, plotId, plantasHa, areaHa, cenario, onCenarioChange }: Props) {
  const v = analysis?.values;
  const [fase, setFase] = useState<Fase>("producao");
  const [safraAnt, setSafraAnt] = useState("");
  const [plantas, setPlantas] = useState(plantasHa != null ? String(Math.round(plantasHa)) : "");
  const [sistema, setSistema] = useState<Sistema>("sequeiro");
  const [vAlvo, setVAlvo] = useState(60); // alvo de saturação por bases (Ve)
  const [history, setHistory] = useState<SavedRecommendation[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [comp, setComp] = useState<Complementos>(() => loadComplementos(plotId));

  // Fases de campo (não produção) trabalham em g/planta e precisam da população.
  const emProducao = fase === "producao";
  const plantasHaNum = parseNumberBR(plantas);

  // Persiste os complementos do laudo por talhão (o que o produtor preenche).
  useEffect(() => {
    if (!plotId || typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(COMP_KEY(plotId), JSON.stringify(comp));
    } catch {
      // segue só em memória
    }
  }, [plotId, comp]);

  const setC = (patch: Partial<Complementos>) => setComp((prev) => ({ ...prev, ...patch }));

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

  // Os valores vêm do laudo; o produtor pode COMPLETAR o que faltou (comp).
  // Ca/Mg em mmolc → cmolc; H+Al e Al são derivados de CTC/V/m% quando ausentes.
  const solo = useMemo(() => {
    const caC = v?.ca != null ? v.ca / 10 : null;
    const mgC = v?.mg != null ? v.mg / 10 : null;
    const kC = v?.k != null ? v.k / 391 : null;
    const sb = caC != null && mgC != null && kC != null ? caC + mgC + kC : null;
    const hAl = v?.hAl ?? (sb != null && v?.ctc != null ? Math.max(0, v.ctc - sb) : null);
    const mPct = v?.mPercent ?? null;
    const al = v?.al ?? (sb != null && mPct != null && mPct < 100 ? (mPct * sb) / (100 - mPct) : null);
    // Complemento sobrepõe o laudo apenas quando preenchido (senão mantém o laudo).
    const or = (raw: string | undefined, base: number | null | undefined) => {
      const n = parseNumberBR(raw ?? "");
      return n ?? base ?? null;
    };
    const extB: ExtratorB | null = comp.extratorB || v?.extratorB || null;
    const extM: ExtratorMetalico | null = comp.extratorMicros || v?.extratorMicros || null;
    return {
      pH_agua: or(comp.ph, v?.ph),
      materia_organica_dag_kg: or(comp.mo, v?.organicMatter),
      P_mg_dm3: v?.p ?? null,
      P_rem_mg_L: or(comp.pRem, v?.pRem),
      argila_percentual: or(comp.argila, v?.argila),
      K_mg_dm3: v?.k ?? null,
      Ca_cmolc_dm3: caC,
      Mg_cmolc_dm3: mgC,
      Al_cmolc_dm3: al,
      H_Al_cmolc_dm3: hAl,
      S_mg_dm3: v?.s ?? null,
      B_mg_dm3: v?.b ?? null,
      extrator_B: extB,
      Cu_mg_dm3: v?.cu ?? null,
      extrator_Cu: extM,
      Mn_mg_dm3: v?.mn ?? null,
      extrator_Mn: extM,
      Zn_mg_dm3: v?.zn ?? null,
      extrator_Zn: extM,
    };
  }, [v, comp]);

  // Análise de 20–40 cm (gessagem): vem do laudo automaticamente; o produtor
  // pode sobrepor no "Completar o laudo".
  const sub = useMemo(() => {
    const ca = parseNumberBR(comp.ca2040 ?? "") ?? v?.ca2040 ?? null;
    const al = parseNumberBR(comp.al2040 ?? "") ?? v?.al2040 ?? null;
    const m = parseNumberBR(comp.m2040 ?? "") ?? v?.m2040 ?? null;
    if (ca === null && al === null && m === null) return null;
    return { Ca_cmolc_dm3: ca, Al_cmolc_dm3: al, m_percentual: m };
  }, [comp.ca2040, comp.al2040, comp.m2040, v?.ca2040, v?.al2040, v?.m2040]);

  const foliar = useMemo(() => {
    const n = parseNumberBR(comp.foliarN ?? "");
    return n === null ? null : { N_dag_kg: n };
  }, [comp.foliarN]);

  const prod = CENARIOS.find((c) => c.id === cenario)?.sacasPorHectare ?? 45;

  const rec = useMemo(
    () =>
      recomendarNutrientes5a({
        lavoura: {
          fase,
          produtividade_esperada_sc_ha: prod,
          produtividade_safra_anterior_sc_ha: parseNumberBR(safraAnt),
          plantas_ha: plantasHaNum,
          sistema,
          Ve_percentual: vAlvo,
          PRNT_percentual: parseNumberBR(comp.prnt ?? "") ?? 95,
        },
        solo,
        sub,
        foliar,
      }),
    [fase, prod, safraAnt, plantasHaNum, sistema, vAlvo, comp.prnt, solo, sub, foliar],
  );

  const c = rec.classificacoes;
  const n = rec.necessidade_nutrientes;
  const fertilizantes = converterFertilizantes(n);
  const formulacao = sugerirFormulacao(n, areaHa ?? null);
  const cronograma = cronogramaAdubacao(n, rec.doses_por_planta?.N_aplicacoes ?? 4);
  const hoje = new Date().toLocaleDateString("pt-BR");

  // Campos críticos que faltam para o motor não assumir (guiam o produtor).
  const faltamCriticos: string[] = [];
  if (solo.P_mg_dm3 !== null && solo.P_rem_mg_L === null && solo.argila_percentual === null) {
    faltamCriticos.push("P-rem/argila");
  }
  if (solo.B_mg_dm3 !== null && !solo.extrator_B) faltamCriticos.push("extrator do B");
  if ((solo.Cu_mg_dm3 !== null || solo.Mn_mg_dm3 !== null || solo.Zn_mg_dm3 !== null) && !solo.extrator_Cu) {
    faltamCriticos.push("extrator Cu/Mn/Zn");
  }

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

      {/* Escolhas mínimas por fase. O resto vem do laudo. */}
      <div className="fert5a-escolhas no-print">
        <label className="fert5a-fase">
          Fase da lavoura
          <select value={fase} onChange={(e) => setFase(e.target.value as Fase)}>
            {FASE_ORDEM.map((f) => (
              <option key={f} value={f}>{FASE_LABEL[f]}</option>
            ))}
          </select>
        </label>

        {emProducao ? (
          <>
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
          </>
        ) : (
          <label className="fert5a-safra">
            População (plantas/ha) <span className="fert5a-opt">converte g/planta → kg/ha</span>
            <input
              inputMode="numeric"
              value={plantas}
              onChange={(e) => setPlantas(e.target.value)}
              placeholder="ex.: 4082"
            />
          </label>
        )}

        <label className="fert5a-sistema">
          Sistema
          <select value={sistema} onChange={(e) => setSistema(e.target.value as Sistema)}>
            <option value="sequeiro">Sequeiro</option>
            <option value="irrigado">Irrigado</option>
          </select>
        </label>

        <label className="fert5a-valvo">
          <span>Alvo de V% <strong>{vAlvo}%</strong></span>
          <input
            type="range"
            min={45}
            max={80}
            step={1}
            value={vAlvo}
            onChange={(e) => setVAlvo(Number(e.target.value))}
            aria-label="Alvo de V%"
          />
        </label>
      </div>

      <details className="fert5a-completar no-print" open={faltamCriticos.length > 0}>
        <summary>
          Completar o laudo (opcional){" "}
          {faltamCriticos.length > 0 && (
            <span className="fert5a-falta-badge">falta: {faltamCriticos.join(", ")}</span>
          )}
        </summary>
        <p className="fert5a-completar-hint">
          Preencha o que a extração do laudo não trouxe. O que ficar em branco usa o laudo; o que
          você informar sobrepõe. Assim o cálculo não precisa assumir nada.
        </p>
        <div className="fert5a-completar-grid">
          <label>
            P-rem (mg/L)
            <input inputMode="decimal" value={comp.pRem ?? ""} onChange={(e) => setC({ pRem: e.target.value })}
              placeholder={v?.pRem != null ? `laudo: ${fmt(v.pRem, 1)}` : "para classificar P e S"} />
          </label>
          <label>
            Argila (%)
            <input inputMode="decimal" value={comp.argila ?? ""} onChange={(e) => setC({ argila: e.target.value })}
              placeholder={v?.argila != null ? `laudo: ${fmt(v.argila, 0)}` : "alternativa ao P-rem p/ P"} />
          </label>
          <label>
            Extrator do Boro
            <select value={comp.extratorB ?? ""} onChange={(e) => setC({ extratorB: e.target.value as ExtratorB | "" })}>
              <option value="">{v?.extratorB ? `laudo: ${v.extratorB}` : "— selecione —"}</option>
              <option value="mehlich1">Mehlich-1</option>
              <option value="hcl">HCl 0,05 mol/L</option>
              <option value="agua_quente">Água quente</option>
            </select>
          </label>
          <label>
            Extrator Cu/Mn/Zn
            <select value={comp.extratorMicros ?? ""} onChange={(e) => setC({ extratorMicros: e.target.value as ExtratorMetalico | "" })}>
              <option value="">{v?.extratorMicros ? `laudo: ${v.extratorMicros}` : "— selecione —"}</option>
              <option value="mehlich1">Mehlich-1</option>
              <option value="dtpa">DTPA</option>
            </select>
          </label>
          <label>
            pH (água)
            <input inputMode="decimal" value={comp.ph ?? ""} onChange={(e) => setC({ ph: e.target.value })}
              placeholder={v?.ph != null ? `laudo: ${fmt(v.ph, 1)}` : "opcional"} />
          </label>
          <label>
            M.O. (dag/kg)
            <input inputMode="decimal" value={comp.mo ?? ""} onChange={(e) => setC({ mo: e.target.value })}
              placeholder={v?.organicMatter != null ? `laudo: ${fmt(v.organicMatter, 1)}` : "opcional"} />
          </label>
          <label>
            PRNT do calcário (%)
            <input inputMode="decimal" value={comp.prnt ?? ""} onChange={(e) => setC({ prnt: e.target.value })}
              placeholder="padrão 95" />
          </label>
          <label>
            N foliar (dag/kg)
            <input inputMode="decimal" value={comp.foliarN ?? ""} onChange={(e) => setC({ foliarN: e.target.value })}
              placeholder="ajusta N (produção)" />
          </label>
        </div>
        <div className="fert5a-completar-sub">
          <span className="fert5a-completar-titulo">Análise de 20–40 cm — para decidir gessagem</span>
          <div className="fert5a-completar-grid">
            <label>
              Ca 20–40 (cmolc)
              <input inputMode="decimal" value={comp.ca2040 ?? ""} onChange={(e) => setC({ ca2040: e.target.value })}
                placeholder={v?.ca2040 != null ? `laudo: ${fmt(v.ca2040, 2)}` : "≤ 0,4 indica"} />
            </label>
            <label>
              Al 20–40 (cmolc)
              <input inputMode="decimal" value={comp.al2040 ?? ""} onChange={(e) => setC({ al2040: e.target.value })}
                placeholder={v?.al2040 != null ? `laudo: ${fmt(v.al2040, 2)}` : "> 0,5 indica"} />
            </label>
            <label>
              m 20–40 (%)
              <input inputMode="decimal" value={comp.m2040 ?? ""} onChange={(e) => setC({ m2040: e.target.value })}
                placeholder={v?.m2040 != null ? `laudo: ${fmt(v.m2040, 0)}` : "> 30 indica"} />
            </label>
          </div>
        </div>
      </details>

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

      {rec.doses_por_planta && (
        <div className="fert5a-planta">
          <h3>Doses por planta · {rec.fase_label}</h3>
          <table>
            <tbody>
              {rec.doses_por_planta.N_g_planta_aplicacao !== null && (
                <tr>
                  <td>N</td>
                  <td>
                    {fmt(rec.doses_por_planta.N_g_planta_aplicacao, 0)} g/planta por aplicação
                    {rec.doses_por_planta.N_aplicacoes
                      ? ` · ${rec.doses_por_planta.N_aplicacoes} parcelas`
                      : ""}
                  </td>
                </tr>
              )}
              {rec.doses_por_planta.K2O_g_planta_ano !== null && (
                <tr><td>K₂O</td><td>{fmt(rec.doses_por_planta.K2O_g_planta_ano, 0)} g/planta·ano</td></tr>
              )}
              {rec.doses_por_planta.P2O5_g_cova !== null && (
                <tr>
                  <td>P₂O₅</td>
                  <td>
                    {fmt(rec.doses_por_planta.P2O5_g_cova, 0)} g/cova ·{" "}
                    {fmt(rec.doses_por_planta.P2O5_g_m_sulco, 0)} g/m de sulco
                  </td>
                </tr>
              )}
              {rec.doses_por_planta.S_g_planta !== null && (
                <tr><td>S</td><td>{fmt(rec.doses_por_planta.S_g_planta, 0)} g/planta <em>(se N/P não fornecerem)</em></td></tr>
              )}
              {rec.doses_por_planta.B_g_planta !== null && rec.doses_por_planta.B_g_planta > 0 && (
                <tr><td>B</td><td>{fmt(rec.doses_por_planta.B_g_planta, 1)} g/planta <em>(no plantio, se indicado)</em></td></tr>
              )}
              {rec.doses_por_planta.Zn_g_planta !== null && rec.doses_por_planta.Zn_g_planta > 0 && (
                <tr><td>Zn</td><td>{fmt(rec.doses_por_planta.Zn_g_planta, 1)} g/planta <em>(no plantio, se indicado)</em></td></tr>
              )}
            </tbody>
          </table>
          <p className="fert5a-planta-obs">
            {rec.doses_por_planta.plantas_ha
              ? `Convertido para kg/ha abaixo com ${fmt(rec.doses_por_planta.plantas_ha, 0)} plantas/ha.`
              : "Informe a população (plantas/ha) para converter em kg/ha."}
          </p>
        </div>
      )}

      <div className="fert5a-results">
        <div className="fert5a-doses">
          <h3>Necessidade de nutrientes {emProducao ? "" : "(kg/ha·ano)"}</h3>
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
            {rec.correcao_solo.calagem_t_ha_produto !== null && (
              <em className="fert5a-valvo-hint"> · alvo V {vAlvo}%</em>
            )}
          </p>
          {rec.correcao_solo.corretivo_sugerido && (
            <p>
              <strong>Corretivo:</strong> {rec.correcao_solo.corretivo_sugerido}{" "}
              <em className="fert5a-valvo-hint">({rec.correcao_solo.corretivo_motivo})</em>
            </p>
          )}
          <p>
            <strong>Gessagem:</strong>{" "}
            {rec.correcao_solo.gessagem_indicada ? (
              rec.correcao_solo.gesso_t_ha !== null ? (
                <>
                  {fmt(rec.correcao_solo.gesso_t_ha, 2)} t/ha de gesso
                  <em className="fert5a-valvo-hint">
                    {" "}
                    · fornece ~{fmt(rec.correcao_solo.gesso_ca_kg_ha, 0)} kg Ca e ~
                    {fmt(rec.correcao_solo.gesso_s_kg_ha, 0)} kg S
                  </em>
                </>
              ) : (
                "indicada (informe a calagem para dimensionar)"
              )
            ) : (
              "não indicada pelos dados atuais"
            )}
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

      {formulacao.principal && (
        <div className="fert5a-formulacao">
          <div className="fert5a-formulacao-head">
            <h3>Melhor formulação para a área</h3>
            {formulacao.area_ha ? (
              <span className="fert5a-area-badge">{fmt(formulacao.area_ha, 2)} ha</span>
            ) : (
              <span className="fert5a-area-badge fert5a-area-badge--off">informe a área do talhão</span>
            )}
          </div>

          <div className="fert5a-formula-principal">
            <div className="fert5a-formula-nome">
              <strong>{formulacao.principal.formula}</strong>
              <small>{formulacao.principal.produto}</small>
            </div>
            <div className="fert5a-formula-num">
              <span className="fert5a-formula-kgha">{fmt(formulacao.principal.kg_ha, 0)} kg/ha</span>
              {formulacao.principal.kg_total !== null && (
                <span className="fert5a-formula-total">
                  {fmt(formulacao.principal.kg_total, 0)} kg no talhão · {fmt(formulacao.principal.sacas_50, 1)} sacas de 50 kg
                </span>
              )}
            </div>
          </div>

          {formulacao.complementos.length > 0 && (
            <table className="fert5a-formula-compl">
              <tbody>
                {formulacao.complementos.map((item) => (
                  <tr key={item.produto}>
                    <td><strong>{item.produto}</strong> <em>{item.formula}</em></td>
                    <td className="fert5a-kg">
                      {fmt(item.kg_ha, 0)} kg/ha
                      {item.kg_total !== null && <small> · {fmt(item.kg_total, 0)} kg</small>}
                    </td>
                    <td className="fert5a-obs">{item.obs ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {formulacao.observacoes.map((o) => (
            <p className="fert5a-formula-obs" key={o}>{o}</p>
          ))}
        </div>
      )}

      {fertilizantes.length > 0 && (
        <details className="fert5a-fertilizantes">
          <summary><h3>Fontes separadas (kg/ha)</h3></summary>
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
        </details>
      )}

      {rec.fontes_micros.length > 0 && (
        <div className="fert5a-micros">
          <h3>Micronutrientes — fonte e aplicação</h3>
          <table>
            <tbody>
              {rec.fontes_micros.map((m) => (
                <tr key={m.nutriente}>
                  <td><strong>{m.nutriente}</strong></td>
                  <td>{m.produto} <em>({m.teor_pct}%)</em></td>
                  <td className="fert5a-kg">{fmt(m.dose_produto_kg_ha, 1)} kg/ha</td>
                  <td className="fert5a-obs">via {m.via}{m.obs ? ` · ${m.obs}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="fert5a-parcelamento">
            Doses de micros têm intervalo estreito entre deficiência e toxidez — validar com análise
            foliar antes de reaplicar.
          </p>
        </div>
      )}

      {cronograma.length > 0 && (
        <div className="fert5a-cronograma">
          <h3>Cronograma de aplicação (águas out–mar)</h3>
          <table>
            <thead>
              <tr><th>Parcela</th><th>Época</th><th>N</th><th>P₂O₅</th><th>K₂O</th><th>S</th></tr>
            </thead>
            <tbody>
              {cronograma.map((par) => (
                <tr key={par.ordem}>
                  <td>{par.ordem}ª</td>
                  <td>{par.epoca}</td>
                  <td>{par.N_kg_ha} kg</td>
                  <td>{par.P2O5_kg_ha || "—"}{par.P2O5_kg_ha ? " kg" : ""}</td>
                  <td>{par.K2O_kg_ha} kg</td>
                  <td>{par.S_kg_ha || "—"}{par.S_kg_ha ? " kg" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="fert5a-parcelamento">
            Doses por hectare. Todo o P₂O₅ na 1ª parcela (localizado). Ajuste as datas à chuva —
            adube com o solo úmido. Se N foliar ≥ 3,5 após a 2ª parcela, cancele a parcela seguinte de N.
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
