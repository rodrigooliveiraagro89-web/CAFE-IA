/**
 * Programa de adubação a partir da necessidade de N-P₂O₅-K₂O (Boletim 100),
 * escolhendo entre fórmulas usuais do mercado — sem marca comercial. Lógica
 * pura e testável: recebe as doses-alvo e a seleção do usuário e devolve os
 * quilos de cada produto que fecham N, P e K.
 *
 * Estratégia: (1) fecha o P₂O₅ pela fonte de fósforo escolhida; (2) fecha o N
 * pela fórmula de cobertura (descontando o N que a fonte de P já trouxe);
 * (3) completa o K₂O que faltar com a fonte de potássio.
 */

export type Fertilizer = {
  id: string;
  nome: string;
  formula: string;
  n: number; // % N
  p: number; // % P₂O₅
  k: number; // % K₂O
  s: number; // % S
};

export const FONTES_P: Fertilizer[] = [
  { id: "map", nome: "MAP (fosfato monoamônico)", formula: "11-52-00", n: 11, p: 52, k: 0, s: 0 },
  { id: "sft", nome: "Superfosfato triplo", formula: "00-41-00", n: 0, p: 41, k: 0, s: 0 },
  { id: "sfs", nome: "Superfosfato simples", formula: "00-18-00", n: 0, p: 18, k: 0, s: 11 },
  { id: "fnr", nome: "Fosfato natural reativo", formula: "00-16-00", n: 0, p: 16, k: 0, s: 0 },
  { id: "none", nome: "Sem fonte de P (P já adequado)", formula: "—", n: 0, p: 0, k: 0, s: 0 },
];

export const FORMULAS_COBERTURA: Fertilizer[] = [
  { id: "270010", nome: "27-00-10 (recomendada p/ K alto)", formula: "27-00-10", n: 27, p: 0, k: 10, s: 0 },
  { id: "300010", nome: "30-00-10", formula: "30-00-10", n: 30, p: 0, k: 10, s: 0 },
  { id: "200020", nome: "20-00-20", formula: "20-00-20", n: 20, p: 0, k: 20, s: 0 },
  { id: "200520", nome: "20-05-20", formula: "20-05-20", n: 20, p: 5, k: 20, s: 0 },
  { id: "250025", nome: "25-00-25", formula: "25-00-25", n: 25, p: 0, k: 25, s: 0 },
  { id: "190419", nome: "19-04-19 (completa)", formula: "19-04-19", n: 19, p: 4, k: 19, s: 0 },
  { id: "sulfam", nome: "Sulfato de amônio (N + S)", formula: "20-00-00", n: 20, p: 0, k: 0, s: 24 },
  { id: "ureia", nome: "Ureia (só N)", formula: "45-00-00", n: 45, p: 0, k: 0, s: 0 },
];

export const FONTES_K: Fertilizer[] = [
  { id: "kcl", nome: "Cloreto de potássio (KCl)", formula: "00-00-60", n: 0, p: 0, k: 60, s: 0 },
  { id: "sop", nome: "Sulfato de potássio (K + S)", formula: "00-00-50", n: 0, p: 0, k: 50, s: 18 },
  { id: "none", nome: "Sem complemento de K", formula: "—", n: 0, p: 0, k: 0, s: 0 },
];

export type ProgramaItem = {
  id: string;
  nome: string;
  formula: string;
  kgPorHectare: number;
};

/** Preço padrão por kg de cada insumo (R$/kg). Editável pelo usuário. */
export const PRECO_PADRAO_KG: Record<string, number> = {
  map: 4.2, sft: 4.0, sfs: 2.2, fnr: 1.8,
  "270010": 3.6, "300010": 3.7, "200020": 3.4, "200520": 3.5,
  "250025": 3.6, "190419": 3.6, sulfam: 2.8, ureia: 4.2,
  kcl: 3.9, sop: 6.5,
};

export type ProgramaAlvo = { n: number; p2o5: number; k2o: number };

export type ProgramaResult = {
  itens: ProgramaItem[];
  entregue: { n: number; p2o5: number; k2o: number; s: number };
  totalKgPorHectare: number;
};

export type ProgramaSelecao = { fonteP: string; cobertura: string; fonteK: string };

function acha(lista: Fertilizer[], id: string): Fertilizer {
  return lista.find((f) => f.id === id) ?? lista[0];
}

export function montarPrograma(alvo: ProgramaAlvo, sel: ProgramaSelecao): ProgramaResult {
  const P = acha(FONTES_P, sel.fonteP);
  const M = acha(FORMULAS_COBERTURA, sel.cobertura);
  const K = acha(FONTES_K, sel.fonteK);

  const itens: ProgramaItem[] = [];
  const entregue = { n: 0, p2o5: 0, k2o: 0, s: 0 };
  const soma = (kg: number, f: Fertilizer) => {
    entregue.n += (kg * f.n) / 100;
    entregue.p2o5 += (kg * f.p) / 100;
    entregue.k2o += (kg * f.k) / 100;
    entregue.s += (kg * f.s) / 100;
  };

  // 1) Fósforo
  if (alvo.p2o5 > 0 && P.p > 0) {
    const kg = (alvo.p2o5 / P.p) * 100;
    itens.push({ id: P.id, nome: P.nome, formula: P.formula, kgPorHectare: kg });
    soma(kg, P);
  }
  // 2) Nitrogênio (fórmula de cobertura), descontando o N já entregue
  const nRestante = Math.max(0, alvo.n - entregue.n);
  if (M.n > 0 && nRestante > 0) {
    const kg = (nRestante / M.n) * 100;
    itens.push({ id: M.id, nome: M.nome.replace(/\s*\(.*\)/, ""), formula: M.formula, kgPorHectare: kg });
    soma(kg, M);
  }
  // 3) Complemento de potássio
  const kRestante = alvo.k2o - entregue.k2o;
  if (kRestante > 0 && K.k > 0) {
    const kg = (kRestante / K.k) * 100;
    itens.push({ id: K.id, nome: K.nome, formula: K.formula, kgPorHectare: kg });
    soma(kg, K);
  }

  const totalKgPorHectare = itens.reduce((acc, it) => acc + it.kgPorHectare, 0);
  return { itens, entregue, totalKgPorHectare };
}

export function gramasPorPlanta(kgPorHectare: number, plantasPorHectare: number): number | null {
  if (!plantasPorHectare || plantasPorHectare <= 0) return null;
  return (kgPorHectare * 1000) / plantasPorHectare;
}

/** Custo do programa por hectare (R$), somando kg × preço de cada insumo. */
export function custoPorHectare(
  programa: ProgramaResult,
  precos: Record<string, number>,
): number {
  return programa.itens.reduce(
    (total, item) => total + item.kgPorHectare * (precos[item.id] ?? 0),
    0,
  );
}
