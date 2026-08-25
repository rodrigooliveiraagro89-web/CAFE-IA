import type { Solo0a20 } from "../../domain/coffeeFertility5a";
import type { SoilValues } from "../../domain/soilAnalysis";

/**
 * Dados dos gráficos de radar (teia) "pH, MO e Macronutrientes" e
 * "Micronutrientes", no estilo do laudo Geban: o teor do solo é plotado como
 * % em relação ao ADEQUADO (100% = anel de referência). Os valores de adequado
 * são referência para café arábica de montanha (aprox.; P varia com o P-rem).
 */

export type RadarDatum = { label: string; pct: number | null; valueLabel: string };

const fmt2 = (x: number) => x.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

function datum(label: string, adequado: number, val: number | null | undefined): RadarDatum {
  const ok = typeof val === "number" && Number.isFinite(val);
  return {
    label,
    pct: ok ? (val / adequado) * 100 : null,
    valueLabel: ok ? fmt2(val) : "—",
  };
}

export function buildMacroRadar(v: SoilValues | undefined | null, solo: Solo0a20): RadarDatum[] {
  return [
    datum("pH", 6.0, v?.ph),
    datum("M.O.", 3.0, v?.organicMatter),
    datum("P", 15, solo.P_mg_dm3),
    datum("K", 80, v?.k),
    datum("Ca", 2.75, solo.Ca_cmolc_dm3),
    datum("Mg", 0.75, solo.Mg_cmolc_dm3),
    datum("S", 7.5, solo.S_mg_dm3),
  ];
}

export function buildMicroRadar(v: SoilValues | undefined | null): RadarDatum[] {
  return [
    datum("B", 0.6, v?.b),
    datum("Cu", 1.2, v?.cu),
    datum("Fe", 30, v?.fe),
    datum("Mn", 12, v?.mn),
    datum("Zn", 5, v?.zn),
  ];
}

// Só vale desenhar o radar com pelo menos 3 eixos preenchidos.
export function temDadosRadar(data: RadarDatum[]): boolean {
  return data.filter((d) => d.pct !== null).length >= 3;
}
