/**
 * correctionEngine — correção do solo pela 5ª Aproximação: calagem (necessidade
 * e dose de produto por PRNT/superfície/profundidade), escolha do corretivo pela
 * relação Ca:Mg, e gessagem (gatilho pela camada 20–40 cm + dose NG = 0,25×NC).
 */
import { num, round } from "./core";
import type { ClasseGeral, Solo20a40 } from "./types";

export const VE_PADRAO = 60;
export const PRNT_PADRAO = 95;

// NC (t/ha, PRNT 100%) = T × (Ve − V) / 100 (T em cmolc/dm³). QC ajusta produto.
export function calcularCalagem(input: {
  T: number | null;
  V: number | null;
  Ve?: number | null;
  PRNT?: number | null;
  superficie_coberta_percentual?: number | null;
  profundidade_correcao_cm?: number | null;
}): { nc_prnt100: number | null; qc_produto: number | null } {
  const T = num(input.T);
  const V = num(input.V);
  if (T === null || V === null) return { nc_prnt100: null, qc_produto: null };
  const Ve = num(input.Ve ?? null) ?? VE_PADRAO;
  const nc = Math.max(0, (T * (Ve - V)) / 100);
  const PRNT = num(input.PRNT ?? null) ?? PRNT_PADRAO;
  const sup = num(input.superficie_coberta_percentual ?? null) ?? 100;
  const prof = num(input.profundidade_correcao_cm ?? null) ?? 20;
  const qc = nc * (sup / 100) * (prof / 20) * (100 / PRNT);
  return {
    nc_prnt100: Math.round(nc * 100) / 100,
    qc_produto: Math.round(qc * 100) / 100,
  };
}

// Seção 3 — escolha do corretivo pela relação Ca:Mg e pela classe de Mg.
export function escolherCorretivo(
  classeMg: ClasseGeral | null,
  caMg: number | null,
): { tipo: string; motivo: string } | null {
  const mgBaixo = classeMg === "muito_baixo" || classeMg === "baixo";
  if (mgBaixo || (caMg !== null && caMg > 5)) {
    return {
      tipo: "Calcário dolomítico",
      motivo:
        caMg !== null && caMg > 5
          ? `relação Ca:Mg ${round(caMg, 1)} alta — repor Mg`
          : "Mg baixo — usar corretivo com Mg",
    };
  }
  if (caMg !== null && caMg < 3) {
    return { tipo: "Calcário calcítico", motivo: `relação Ca:Mg ${round(caMg, 1)} baixa — priorizar Ca` };
  }
  return { tipo: "Calcário dolomítico", motivo: "manter a relação Ca:Mg entre 3:1 e 5:1" };
}

export function gessagemIndicada(sub: Solo20a40 | null | undefined): boolean {
  if (!sub) return false;
  const Ca = num(sub.Ca_cmolc_dm3);
  const Al = num(sub.Al_cmolc_dm3);
  const m = num(sub.m_percentual);
  return (Ca !== null && Ca <= 0.4) || (Al !== null && Al > 0.5) || (m !== null && m > 30);
}

// Seção 3 — dose de gesso (NG = 0,25 × NC), quando a gessagem é indicada e há
// necessidade de calagem. O gesso fornece ~16% Ca e ~15% S.
export function doseGessagem(
  ncPrnt100: number | null,
  indicada: boolean,
): { gesso_t_ha: number | null; ca_kg_ha: number | null; s_kg_ha: number | null } {
  if (!indicada || ncPrnt100 === null || ncPrnt100 <= 0) {
    return { gesso_t_ha: null, ca_kg_ha: null, s_kg_ha: null };
  }
  const t = round(0.25 * ncPrnt100, 2);
  const kg = t * 1000;
  return { gesso_t_ha: t, ca_kg_ha: Math.round(kg * 0.16), s_kg_ha: Math.round(kg * 0.15) };
}
