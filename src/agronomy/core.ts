/**
 * Primitivas compartilhadas da camada agronômica: saneamento numérico,
 * arredondamento e o cálculo dos índices do complexo de troca (SB, T, t, V, m,
 * Ca:Mg). Usadas por todos os engines.
 */
import type { Solo0a20 } from "./types";

const K_DIVISOR_CMOLC = 391; // K(mg/dm³)/391 = K(cmolc/dm³)

export function num(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function round(value: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

export function calcularIndices(s: Solo0a20) {
  const Ca = num(s.Ca_cmolc_dm3);
  const Mg = num(s.Mg_cmolc_dm3);
  const Al = num(s.Al_cmolc_dm3);
  const HAl = num(s.H_Al_cmolc_dm3);
  const Kmg = num(s.K_mg_dm3);
  const K = Kmg !== null ? Kmg / K_DIVISOR_CMOLC : null;
  const SB = Ca !== null && Mg !== null && K !== null ? Ca + Mg + K : null;
  const T = SB !== null && HAl !== null ? SB + HAl : null;
  const t = SB !== null && Al !== null ? SB + Al : null;
  const V = SB !== null && T !== null && T > 0 ? (100 * SB) / T : null;
  const m = t !== null && Al !== null && t > 0 ? (100 * Al) / t : null;
  const CaMg = Ca !== null && Mg !== null && Mg > 0 ? Ca / Mg : null;
  return { K_cmolc_dm3: K, SB, T, t, V_percentual: V, m_percentual: m, Ca_Mg_ratio: CaMg };
}
