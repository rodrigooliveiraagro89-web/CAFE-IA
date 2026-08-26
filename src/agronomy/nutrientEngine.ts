/**
 * nutrientEngine — necessidade de nutrientes (N, K2O, P2O5, S) pela 5ª
 * Aproximação: tabelas de produção por produtividade/classe, doses por planta
 * das fases de campo, ajuste de bienalidade e dose de S/B/Zn. Puro.
 */
import { round } from "./core";
import type { ClasseGeral, ClasseMicro, Fase } from "./types";

// --------------------------------------------- N, K2O, P2O5 em produção ------

// Índice da faixa de produtividade (sc/ha): <20,20–30,30–40,40–50,50–60,>60.
export function faixaProdutividade(sc: number): number {
  if (sc < 20) return 0;
  if (sc <= 30) return 1;
  if (sc <= 40) return 2;
  if (sc <= 50) return 3;
  if (sc <= 60) return 4;
  return 5;
}

// Seção 8 — N (kg/ha/ano): colunas [Nf<2,5 | 2,6–3,0 | 3,1–3,5 | sem análise].
export const N_PRODUCAO: number[][] = [
  [200, 140, 80, 200],
  [250, 175, 110, 250],
  [300, 220, 140, 300],
  [350, 260, 170, 350],
  [400, 300, 200, 400],
  [450, 340, 230, 450],
];
// Seção 8 — K2O (kg/ha/ano): colunas [K<60 | 60–120 | 120–200 | >200].
export const K2O_PRODUCAO: number[][] = [
  [150, 100, 0, 0],
  [190, 125, 0, 0],
  [225, 150, 0, 0],
  [260, 175, 50, 0],
  [300, 200, 75, 0],
  [340, 225, 100, 0],
];
// Seção 9 — P2O5 (kg/ha/ano): colunas por classe [MB | B | M | Bom | MuitoBom].
export const P2O5_PRODUCAO: number[][] = [
  [30, 20, 10, 0, 0],
  [40, 30, 20, 0, 0],
  [50, 40, 25, 0, 0],
  [60, 50, 30, 15, 0],
  [70, 55, 35, 18, 0],
  [80, 60, 40, 20, 0],
];

export function colunaNfoliar(nFoliar: number | null): number {
  if (nFoliar === null) return 3; // sem análise
  if (nFoliar < 2.5) return 0;
  if (nFoliar <= 3.0) return 1;
  return 2; // 3,1–3,5 (e acima, com regra de cancelamento de parcelas)
}

// Coluna da tabela por classe de K (mg/dm³). Retorna -1 quando o K é
// desconhecido — o K2O NÃO é calculado (não assumir solo rico).
export function colunaK(Kmg: number | null): number {
  if (Kmg === null) return -1;
  if (Kmg < 60) return 0;
  if (Kmg <= 120) return 1;
  if (Kmg <= 200) return 2;
  return 3;
}

export const CLASSE_P_INDEX: Record<ClasseGeral, number> = {
  muito_baixo: 0,
  baixo: 1,
  medio: 2,
  bom: 3,
  muito_bom: 4,
};

// -------------------------------------- N, K2O g/planta (fases de campo) -----

// N por planta e por APLICAÇÃO (seções 5.2/6/7). Multiplicar por nº de parcelas.
export const N_G_PLANTA_APLIC: Record<Fase, number | null> = {
  implantacao: null,
  pos_plantio: 4, // 3–5 g/planta/aplicação
  formacao_1_ano: 10,
  formacao_2_ano: 20,
  recepado_1_ano: 20, // = 2º ano de formação
  esqueletado_1_ano: 20,
  producao: null,
};

// K2O por planta e por ANO (g/planta/ano) por classe de K [<60 | 60–120 | 120–200 | >200].
export const K2O_G_PLANTA_ANO: Record<Fase, [number, number, number, number] | null> = {
  implantacao: null,
  pos_plantio: [30, 20, 10, 0],
  formacao_1_ano: [40, 20, 10, 0],
  formacao_2_ano: [60, 40, 20, 0],
  recepado_1_ano: [60, 40, 20, 0],
  esqueletado_1_ano: [60, 40, 20, 0],
  producao: null,
};

// Nº de parcelas de N sugerido por fase (o RT pode ajustar).
export const PARCELAS_PADRAO: Record<Fase, number> = {
  implantacao: 1,
  pos_plantio: 4, // do pegamento ao fim das chuvas, a cada 30–45 dias
  formacao_1_ano: 3,
  formacao_2_ano: 3,
  recepado_1_ano: 3,
  esqueletado_1_ano: 3,
  producao: 4,
};

// Seção 5.1 — dose de P2O5 na cova por classe de P (implantação), g/cova.
export const P2O5_COVA_G: Record<ClasseGeral, number> = {
  muito_baixo: 80,
  baixo: 65,
  medio: 50,
  bom: 35,
  muito_bom: 20,
};
export const SULCO_FATOR = 2.5; // g/m de sulco = g/cova × 2,5

export function gPlantaParaKgHa(gPorPlanta: number | null, plantasHa: number | null): number | null {
  if (gPorPlanta === null || plantasHa === null || plantasHa <= 0) return null;
  return round((gPorPlanta * plantasHa) / 1000, 0);
}

// Seção 8.1 — ajuste de bienalidade.
export function produtividadeCalculo(esperada: number | null, anterior: number | null): number | null {
  if (esperada === null) return null;
  if (anterior !== null && esperada < 0.5 * anterior) return (anterior + esperada) / 2;
  return esperada;
}

// Seção 10 — dose de S a partir do N recomendado e da classe de S.
export function doseEnxofre(N_kg_ha: number | null, classeS: ClasseGeral | null): number | null {
  if (N_kg_ha === null) return null;
  if (classeS === null || classeS === "muito_baixo" || classeS === "baixo") return Math.round((N_kg_ha / 8) * 10) / 10;
  if (classeS === "medio") return Math.round((N_kg_ha / 16) * 10) / 10;
  return 0;
}

// B/Zn de plantio (g/planta) só quando o teor indicar necessidade (seção 5.2).
export function boroPlantioGPlanta(classeB: ClasseMicro | null): number | null {
  if (classeB === "baixo") return 1.0;
  if (classeB === "medio") return 0.6;
  return classeB ? 0 : null;
}
export function zincoPlantioGPlanta(classeZn: ClasseMicro | null): number | null {
  if (classeZn === "baixo") return 2.0;
  if (classeZn === "medio") return 1.0;
  return classeZn ? 0 : null;
}
