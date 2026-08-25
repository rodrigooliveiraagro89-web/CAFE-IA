import {
  converterFertilizantes,
  recomendarNutrientes5a,
  sugerirFormulacao,
} from "../../domain/coffeeFertility5a";
import { ClassStrip } from "../fertilization/ClassStrip";
import { buildMacroRadar, buildMicroRadar, temDadosRadar } from "../fertilization/radar";
import { analysisToSolo, subFromValues } from "../fertilization/soilToSolo";
import { BarChart } from "./charts/BarChart";
import { RadarChart } from "./charts/RadarChart";
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

export function Fertility5aReport({
  analysis,
  sacas,
  areaHa = null,
}: {
  analysis: SoilAnalysis;
  sacas: number;
  areaHa?: number | null;
}) {
  const v = analysis.values;
  const caC = v.ca != null ? v.ca / 10 : null;
  const mgC = v.mg != null ? v.mg / 10 : null;

  const rec = recomendarNutrientes5a({
    lavoura: { fase: "producao", produtividade_esperada_sc_ha: sacas, PRNT_percentual: 95 },
    solo: analysisToSolo(v),
    sub: subFromValues(v),
  });

  const c = rec.classificacoes;
  const n = rec.necessidade_nutrientes;
  const fertilizantes = converterFertilizantes(n);
  const formulacao = sugerirFormulacao(n, areaHa);
  const macroRadar = buildMacroRadar(v, analysisToSolo(v));
  const microRadar = buildMicroRadar(v);

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
            {rec.correcao_solo.corretivo_sugerido ? ` · ${rec.correcao_solo.corretivo_sugerido}` : ""}
          </p>
          <p className="fert5a-correcao">
            <strong>Gessagem:</strong>{" "}
            {rec.correcao_solo.gessagem_indicada
              ? rec.correcao_solo.gesso_t_ha !== null
                ? `${fmt(rec.correcao_solo.gesso_t_ha, 2)} t/ha (≈${fmt(rec.correcao_solo.gesso_ca_kg_ha, 0)} kg Ca, ${fmt(rec.correcao_solo.gesso_s_kg_ha, 0)} kg S)`
                : "indicada"
              : "não indicada"}
          </p>
        </div>
        {formulacao.principal && (
          <div className="fert5a-formulacao">
            <div className="fert5a-formulacao-head">
              <h3>Melhor formulação para a área</h3>
              {formulacao.area_ha ? (
                <span className="fert5a-area-badge">{fmt(formulacao.area_ha, 2)} ha</span>
              ) : (
                <span className="fert5a-area-badge fert5a-area-badge--off">área não informada</span>
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
                        {item.kg_total !== null && ` · ${fmt(item.kg_total, 0)} kg`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {fertilizantes.length > 0 && (
          <div className="fert5a-fertilizantes">
            <h3>Fontes separadas (kg/ha)</h3>
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
        {rec.fontes_micros.length > 0 && (
          <div className="fert5a-micros">
            <h3>Micronutrientes — fonte e via</h3>
            <table>
              <tbody>
                {rec.fontes_micros.map((m) => (
                  <tr key={m.nutriente}>
                    <td><strong>{m.nutriente}</strong></td>
                    <td>{m.produto} <em>({m.teor_pct}%)</em></td>
                    <td className="fert5a-kg">{fmt(m.dose_produto_kg_ha, 1)} kg/ha</td>
                    <td className="fert5a-obs">via {m.via}</td>
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

      {(temDadosRadar(macroRadar) || temDadosRadar(microRadar)) && (
        <div className="fert5a-charts">
          {temDadosRadar(macroRadar) && (
            <div className="fert5a-chart">
              <h3>pH, M.O. e Macronutrientes</h3>
              <RadarChart data={macroRadar} />
              <div className="radar-legend">
                <span><i className="leg-medido" /> Teor do solo</span>
                <span><i className="leg-adeq" /> Adequado (100%)</span>
              </div>
            </div>
          )}
          {temDadosRadar(microRadar) && (
            <div className="fert5a-chart">
              <h3>Micronutrientes</h3>
              <RadarChart data={microRadar} />
              <div className="radar-legend">
                <span><i className="leg-medido" /> Teor do solo</span>
                <span><i className="leg-adeq" /> Adequado (100%)</span>
              </div>
            </div>
          )}
        </div>
      )}

      <p className="fert5a-fonte">
        5ª Aproximação de Minas Gerais + Manual do Café (Emater-MG) · produção de referência {fmt(sacas, 0)} sc/ha.
        Radares: teor do solo em % do adequado (referência café).
      </p>
    </div>
  );
}
