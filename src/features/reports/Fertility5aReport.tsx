import {
  converterFertilizantes,
  recomendarNutrientes5a,
} from "../../domain/coffeeFertility5a";
import { ClassStrip } from "../fertilization/ClassStrip";
import { BarChart } from "./charts/BarChart";
import type { SoilAnalysis } from "../soil/soilStore";
import "../fertilization/fertilization.css";

/**
 * Bloco ESTÁTICO da recomendação 5ª Aproximação para o Relatório PDF (sem
 * formulário). Puxa o laudo do talhão e uma produtividade (sc/ha) e mostra
 * classes/régua, doses, correção e a sugestão de fertilizantes.
 */

const CLASSE_LABEL: Record<string, string> = {
  muito_baixo: "Muito baixo",
  baixo: "Baixo",
  medio: "Médio",
  bom: "Bom",
  muito_bom: "Muito bom",
  adequado: "Adequado",
  alto: "Alto",
};

function fmt(value: number | null | undefined, digits = 1): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toLocaleString("pt-BR", { maximumFractionDigits: digits });
}

export function Fertility5aReport({ analysis, sacas }: { analysis: SoilAnalysis; sacas: number }) {
  const v = analysis.values;
  const caC = v.ca != null ? v.ca / 10 : null;
  const mgC = v.mg != null ? v.mg / 10 : null;
  const kC = v.k != null ? v.k / 391 : null;
  const sb = caC != null && mgC != null && kC != null ? caC + mgC + kC : null;
  const hAl = v.hAl ?? (sb != null && v.ctc != null ? Math.max(0, v.ctc - sb) : null);
  const mPct = v.mPercent ?? null;
  const al = v.al ?? (sb != null && mPct != null && mPct < 100 ? (mPct * sb) / (100 - mPct) : null);

  const rec = recomendarNutrientes5a({
    lavoura: { fase: "producao", produtividade_esperada_sc_ha: sacas, PRNT_percentual: 95 },
    solo: {
      pH_agua: v.ph ?? null,
      materia_organica_dag_kg: v.organicMatter ?? null,
      P_mg_dm3: v.p ?? null,
      P_rem_mg_L: v.pRem ?? null,
      argila_percentual: v.argila ?? null,
      K_mg_dm3: v.k ?? null,
      Ca_cmolc_dm3: caC,
      Mg_cmolc_dm3: mgC,
      Al_cmolc_dm3: al,
      H_Al_cmolc_dm3: hAl,
      S_mg_dm3: v.s ?? null,
      B_mg_dm3: v.b ?? null,
      extrator_B: v.extratorB ?? null,
      Cu_mg_dm3: v.cu ?? null,
      extrator_Cu: v.extratorMicros ?? null,
      Mn_mg_dm3: v.mn ?? null,
      extrator_Mn: v.extratorMicros ?? null,
      Zn_mg_dm3: v.zn ?? null,
      extrator_Zn: v.extratorMicros ?? null,
    },
  });

  const c = rec.classificacoes;
  const n = rec.necessidade_nutrientes;
  const fertilizantes = converterFertilizantes(n);

  const soilRows = (
    [
      { nome: "M.O.", valor: v.organicMatter, unidade: "dag/kg", classe: c.materia_organica, escala: "geral" as const },
      { nome: "Ca", valor: caC, unidade: "cmolc", classe: c.Ca, escala: "geral" as const },
      { nome: "Mg", valor: mgC, unidade: "cmolc", classe: c.Mg, escala: "geral" as const },
      { nome: "V", valor: rec.indices.V_percentual, unidade: "%", classe: c.V, escala: "geral" as const },
      { nome: "P", valor: v.p, unidade: "mg/dm³", classe: c.P, escala: "geral" as const },
      { nome: "S", valor: v.s, unidade: "mg/dm³", classe: c.S, escala: "geral" as const },
      { nome: "B", valor: v.b, unidade: "mg/dm³", classe: c.B, escala: "micro" as const },
      { nome: "Cu", valor: v.cu, unidade: "mg/dm³", classe: c.Cu, escala: "micro" as const },
      { nome: "Mn", valor: v.mn, unidade: "mg/dm³", classe: c.Mn, escala: "micro" as const },
      { nome: "Zn", valor: v.zn, unidade: "mg/dm³", classe: c.Zn, escala: "micro" as const },
    ] as { nome: string; valor: number | null | undefined; unidade: string; classe: string | null; escala: "geral" | "micro" }[]
  ).filter((r) => typeof r.valor === "number" && r.classe);

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

  const T = rec.indices.T;
  const SB = rec.indices.SB;
  const K = rec.indices.K_cmolc_dm3;
  const participacaoChart =
    T && T > 0
      ? [
          { label: "Ca", value: (100 * (caC ?? 0)) / T },
          { label: "Mg", value: (100 * (mgC ?? 0)) / T },
          { label: "K", value: (100 * (K ?? 0)) / T },
          { label: "H+Al", value: (100 * Math.max(0, T - (SB ?? 0))) / T },
        ].map((d) => ({ label: d.label, value: Math.round(d.value * 10) / 10 }))
      : [];

  return (
    <div className="fert5a report-fert5a">
      <div className="fert5a-indices">
        <span><small>V</small><strong>{fmt(rec.indices.V_percentual)}%</strong></span>
        <span><small>m</small><strong>{fmt(rec.indices.m_percentual)}%</strong></span>
        <span><small>CTC (T)</small><strong>{fmt(rec.indices.T, 2)}</strong></span>
        <span><small>SB</small><strong>{fmt(rec.indices.SB, 2)}</strong></span>
      </div>

      {soilRows.length > 0 && (
        <div className="fert5a-interpret">
          <div className="interpret-rows">
            {soilRows.map((r) => (
              <div className="interpret-row" key={r.nome}>
                <span className="interpret-nome">{r.nome}</span>
                <span className="interpret-valor">{fmt(r.valor as number, 2)} <em>{r.unidade}</em></span>
                <ClassStrip escala={r.escala} classe={r.classe as string} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="fert5a-results">
        <div className="fert5a-doses">
          <h3>Necessidade de nutrientes</h3>
          <table>
            <tbody>
              <tr><td>N</td><td>{fmt(n.N_kg_ha_ano)} kg/ha·ano</td></tr>
              <tr><td>P₂O₅</td><td>{fmt(n.P2O5_kg_ha_ano)} kg/ha·ano <em>({CLASSE_LABEL[c.P ?? ""] ?? "—"})</em></td></tr>
              <tr><td>K₂O</td><td>{fmt(n.K2O_kg_ha_ano)} kg/ha·ano</td></tr>
              <tr><td>S</td><td>{fmt(n.S_kg_ha_ano)} kg/ha·ano</td></tr>
            </tbody>
          </table>
          <p className="fert5a-correcao">
            <strong>Calagem:</strong>{" "}
            {rec.correcao_solo.calagem_t_ha_produto !== null
              ? `${fmt(rec.correcao_solo.calagem_t_ha_produto, 2)} t/ha`
              : "—"}
            {rec.correcao_solo.gessagem_indicada ? " · Gessagem indicada" : ""}
          </p>
        </div>
        {fertilizantes.length > 0 && (
          <div className="fert5a-fertilizantes">
            <h3>Fertilizantes (kg/ha)</h3>
            <table>
              <tbody>
                {fertilizantes.map((item) => (
                  <tr key={item.produto}>
                    <td><strong>{item.produto}</strong> <em>{item.formula}</em></td>
                    <td className="fert5a-kg">{fmt(item.kg_ha, 0)} kg/ha</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(dosesChart.length > 0 || participacaoChart.length > 0) && (
        <div className="fert5a-charts">
          {dosesChart.length > 0 && (
            <div className="fert5a-chart">
              <h3>Doses (kg/ha·ano)</h3>
              <BarChart data={dosesChart} formatValue={(x) => `${x.toLocaleString("pt-BR")} kg`} color="var(--agryn-emerald, #22c55e)" />
            </div>
          )}
          {participacaoChart.length > 0 && (
            <div className="fert5a-chart">
              <h3>Bases na CTC (%)</h3>
              <BarChart data={participacaoChart} formatValue={(x) => `${x.toLocaleString("pt-BR")}%`} color="var(--info, #2563eb)" />
            </div>
          )}
        </div>
      )}

      <p className="fert5a-fonte">
        5ª Aproximação de Minas Gerais + Manual do Café (Emater-MG) · produção de referência {fmt(sacas, 0)} sc/ha.
      </p>
    </div>
  );
}
