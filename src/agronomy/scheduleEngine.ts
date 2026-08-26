/**
 * scheduleEngine — parcelamento das doses anuais ao longo das águas (out–mar).
 */
import { num } from "./core";
import type { ParcelaAdubacao, Recomendacao5a } from "./types";

const EPOCAS_PARCELAS: Record<number, string[]> = {
  2: ["Outubro/Novembro", "Janeiro/Fevereiro"],
  3: ["Outubro", "Dezembro", "Fevereiro"],
  4: ["Outubro", "Novembro", "Janeiro", "Março"],
};

/**
 * Divide as doses anuais em parcelas ao longo das águas (out–mar). N, K2O e S
 * são divididos igualmente entre as parcelas; o P2O5 vai todo na 1ª aplicação
 * (localizado). Base: seção 8 (parcelar N e K em 3–4 vezes de out a mar).
 */
export function cronogramaAdubacao(
  n: Recomendacao5a["necessidade_nutrientes"],
  numParcelas = 4,
): ParcelaAdubacao[] {
  const N = num(n.N_kg_ha_ano);
  if (N === null || N <= 0) return [];
  const p = Math.min(4, Math.max(2, numParcelas));
  const epocas = EPOCAS_PARCELAS[p];
  const K = num(n.K2O_kg_ha_ano) ?? 0;
  const P = num(n.P2O5_kg_ha_ano) ?? 0;
  const S = num(n.S_kg_ha_ano) ?? 0;
  const parcelas: ParcelaAdubacao[] = [];
  for (let i = 0; i < p; i++) {
    parcelas.push({
      ordem: i + 1,
      epoca: epocas[i],
      N_kg_ha: Math.round(N / p),
      P2O5_kg_ha: i === 0 ? Math.round(P) : 0, // todo o P na 1ª (localizado)
      K2O_kg_ha: Math.round(K / p),
      S_kg_ha: Math.round(S / p),
    });
  }
  return parcelas;
}
