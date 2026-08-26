/**
 * soilEngine — classificação do solo pela 5ª Aproximação: classes gerais do
 * complexo de troca (M.O., Ca, Mg, T, V), fósforo (manutenção e implantação),
 * enxofre e micronutrientes por extrator. Puro; sem dependência da UI.
 */
import type { ClasseGeral, ClasseMicro, ExtratorB, ExtratorMetalico, MicroSaida } from "./types";

// Classifica por limites superiores [mb, b, m, bom]; acima do último = muito_bom.
export function classeGeral(value: number | null, lim: [number, number, number, number]): ClasseGeral | null {
  if (value === null) return null;
  if (value <= lim[0]) return "muito_baixo";
  if (value <= lim[1]) return "baixo";
  if (value <= lim[2]) return "medio";
  if (value <= lim[3]) return "bom";
  return "muito_bom";
}

// Seção 2 — classes gerais do complexo de troca.
export const LIM_MO: [number, number, number, number] = [0.7, 2.0, 4.0, 7.0];
export const LIM_CA: [number, number, number, number] = [0.4, 1.2, 2.4, 4.0];
export const LIM_MG: [number, number, number, number] = [0.15, 0.45, 0.9, 1.5];
export const LIM_T: [number, number, number, number] = [1.6, 4.3, 8.6, 15.0];
export const LIM_V: [number, number, number, number] = [20, 40, 60, 80];

// ------------------------------------------------- fósforo (P) manutenção ----
// Seção 4 — thresholds [mb, b, m, bom] por faixa de P-rem (mg/L). Acima = muito_bom.
const P_MANUT_PREM: { premMax: number; lim: [number, number, number, number] }[] = [
  { premMax: 4, lim: [2.3, 3.2, 4.5, 6.8] },
  { premMax: 10, lim: [3.0, 4.5, 6.2, 9.4] },
  { premMax: 19, lim: [4.5, 6.2, 8.5, 13.1] },
  { premMax: 30, lim: [6.0, 8.5, 11.9, 18.0] },
  { premMax: 44, lim: [8.3, 11.9, 16.4, 24.8] },
  { premMax: 60, lim: [11.3, 16.4, 22.5, 33.8] },
];

// Fallback por teor de argila (%) — thresholds [mb, b, m, bom].
const P_MANUT_ARGILA: { argilaMax: number; lim: [number, number, number, number] }[] = [
  { argilaMax: 15, lim: [7.5, 15.0, 22.5, 33.8] },
  { argilaMax: 35, lim: [5.0, 9.0, 15.0, 22.5] },
  { argilaMax: 60, lim: [3.0, 6.0, 9.0, 13.5] },
  { argilaMax: 100, lim: [1.9, 4.0, 6.0, 9.0] },
];

// Seção 5.1 — thresholds de P para IMPLANTAÇÃO (mais altos que manutenção), por P-rem.
const P_IMPLANT_PREM: { premMax: number; lim: [number, number, number, number] }[] = [
  { premMax: 4, lim: [9.0, 13.0, 18.0, 24.0] },
  { premMax: 10, lim: [12.0, 18.0, 25.0, 37.5] },
  { premMax: 19, lim: [18.0, 25.0, 34.2, 52.5] },
  { premMax: 30, lim: [24.0, 34.2, 47.4, 72.0] },
  { premMax: 44, lim: [33.0, 47.4, 65.4, 99.0] },
  { premMax: 60, lim: [45.0, 65.4, 90.0, 135.0] },
];

export function classificarP(
  P: number | null,
  Prem: number | null,
  argila: number | null,
): ClasseGeral | null {
  if (P === null) return null;
  if (Prem !== null) {
    const faixa = P_MANUT_PREM.find((f) => Prem <= f.premMax) ?? P_MANUT_PREM[P_MANUT_PREM.length - 1];
    return classeGeral(P, faixa.lim);
  }
  if (argila !== null) {
    const faixa = P_MANUT_ARGILA.find((f) => argila <= f.argilaMax) ?? P_MANUT_ARGILA[P_MANUT_ARGILA.length - 1];
    return classeGeral(P, faixa.lim);
  }
  return null; // trava: sem P-rem nem argila não classifica (seção 14.1)
}

// Seção 5.1 — classe de P para implantação (só por P-rem; sem P-rem não calcula).
export function classificarPImplantacao(P: number | null, Prem: number | null): ClasseGeral | null {
  if (P === null || Prem === null) return null;
  const faixa = P_IMPLANT_PREM.find((f) => Prem <= f.premMax) ?? P_IMPLANT_PREM[P_IMPLANT_PREM.length - 1];
  return classeGeral(P, faixa.lim);
}

// --------------------------------------------------------- enxofre (S) -------
// Seção 10 — thresholds [mb, b, m, bom] por faixa de P-rem.
const S_PREM: { premMax: number; lim: [number, number, number, number] }[] = [
  { premMax: 4, lim: [1.7, 2.5, 3.6, 5.4] },
  { premMax: 10, lim: [2.4, 3.6, 5.0, 7.5] },
  { premMax: 19, lim: [3.3, 5.0, 6.9, 10.3] },
  { premMax: 30, lim: [4.6, 6.9, 9.4, 14.2] },
  { premMax: 44, lim: [6.4, 9.4, 13.0, 19.6] },
  { premMax: 60, lim: [8.9, 13.0, 18.0, 27.0] },
];

export function classificarS(S: number | null, Prem: number | null): ClasseGeral | null {
  if (S === null || Prem === null) return null;
  const faixa = S_PREM.find((f) => Prem <= f.premMax) ?? S_PREM[S_PREM.length - 1];
  return classeGeral(S, faixa.lim);
}

// ------------------------------------------------------- micronutrientes -----
// Seção 11 — thresholds [baixo, medio, adequado]; acima = alto. Doses por classe.
export type MicroFaixa = { lim: [number, number, number]; doses: [number, number, number, number] };
export const MICRO_B: Record<ExtratorB, MicroFaixa> = {
  mehlich1: { lim: [0.3, 0.7, 1.0], doses: [3, 2, 1, 0] },
  hcl: { lim: [0.3, 0.7, 1.0], doses: [3, 2, 1, 0] },
  agua_quente: { lim: [0.2, 0.4, 0.6], doses: [3, 2, 1, 0] },
};
export const MICRO_CU: Record<ExtratorMetalico, MicroFaixa> = {
  mehlich1: { lim: [0.5, 1.0, 1.5], doses: [3, 2, 1, 0] },
  dtpa: { lim: [0.3, 0.6, 1.0], doses: [3, 2, 1, 0] },
};
export const MICRO_MN: Record<ExtratorMetalico, MicroFaixa> = {
  mehlich1: { lim: [5.0, 10.0, 15.0], doses: [15, 10, 5, 0] },
  dtpa: { lim: [1.0, 2.5, 5.0], doses: [15, 10, 5, 0] },
};
export const MICRO_ZN: Record<ExtratorMetalico, MicroFaixa> = {
  mehlich1: { lim: [2.0, 4.0, 6.0], doses: [6, 4, 2, 0] },
  dtpa: { lim: [0.6, 1.1, 1.5], doses: [6, 4, 2, 0] },
};

function classeMicro(value: number, lim: [number, number, number]): { classe: ClasseMicro; idx: number } {
  if (value <= lim[0]) return { classe: "baixo", idx: 0 };
  if (value <= lim[1]) return { classe: "medio", idx: 1 };
  if (value <= lim[2]) return { classe: "adequado", idx: 2 };
  return { classe: "alto", idx: 3 };
}

export function avaliarMicro(value: number | null, extrator: string | null | undefined, faixa: MicroFaixa | undefined): MicroSaida {
  // Trava 14.2: sem extrator ou sem valor, não é calculável automaticamente.
  if (value === null || !extrator || !faixa) return { classe: null, dose_kg_ha: null };
  const { classe, idx } = classeMicro(value, faixa.lim);
  return { classe, dose_kg_ha: faixa.doses[idx] };
}
