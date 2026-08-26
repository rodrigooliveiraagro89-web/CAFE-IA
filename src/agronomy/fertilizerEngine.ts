/**
 * fertilizerEngine — traduz a necessidade em NUTRIENTE para produtos comerciais:
 * fontes dos micros, conversão em fontes usuais (MAP/ureia/KCl/gesso), escolha
 * do MELHOR formulado do catálogo dimensionado para a área e a lista de compras
 * agregada da propriedade.
 */
import { FORMULAS_TURBO } from "../domain/formulasTurbo";
import { num } from "./core";
import type {
  FertilizanteItem,
  FormulacaoItem,
  FormulacaoPlano,
  MicroFonte,
  Recomendacao5a,
} from "./types";

// Seção 11 — fontes comerciais dos micronutrientes e via de aplicação.
const MICRO_FONTES: Record<string, { produto: string; teor: number; via: string; obs?: string }> = {
  B: { produto: "Ácido bórico", teor: 17, via: "solo", obs: "B corrige-se preferencialmente via solo" },
  Zn: { produto: "Sulfato de zinco", teor: 20, via: "solo ou foliar" },
  Cu: { produto: "Sulfato de cobre", teor: 13, via: "foliar ou solo", obs: "descontar Cu de fungicidas cúpricos" },
  Mn: { produto: "Sulfato de manganês", teor: 26, via: "foliar" },
};

export function fontesMicros(n: Recomendacao5a["necessidade_nutrientes"]): MicroFonte[] {
  const itens: MicroFonte[] = [];
  const mapa: [string, number | null][] = [
    ["B", n.B_kg_ha],
    ["Zn", n.Zn_kg_ha],
    ["Cu", n.Cu_kg_ha],
    ["Mn", n.Mn_kg_ha],
  ];
  for (const [nut, dose] of mapa) {
    const d = num(dose);
    if (d === null || d <= 0) continue;
    const f = MICRO_FONTES[nut];
    itens.push({
      nutriente: nut,
      produto: f.produto,
      teor_pct: f.teor,
      dose_produto_kg_ha: Math.round((d / (f.teor / 100)) * 10) / 10,
      via: f.via,
      obs: f.obs,
    });
  }
  return itens;
}

/**
 * Converte a necessidade em NUTRIENTE para fontes comerciais usuais, de forma
 * transparente (o RT pode trocar por outra fonte/formulado). P via MAP, o N que
 * sobra via ureia, K via KCl e S via gesso agrícola. Micros ficam como dose do
 * elemento (a fonte varia muito). Parcelar N e K em 3–4 vezes (out–mar).
 */
export function converterFertilizantes(
  n: Recomendacao5a["necessidade_nutrientes"],
): FertilizanteItem[] {
  const itens: FertilizanteItem[] = [];
  const N = n.N_kg_ha_ano ?? 0;
  const p2o5 = n.P2O5_kg_ha_ano ?? 0;
  const k2o = n.K2O_kg_ha_ano ?? 0;
  const s = n.S_kg_ha_ano ?? 0;
  let nRestante = N;
  if (p2o5 > 0) {
    const kgMap = p2o5 / 0.52;
    const nDoMap = kgMap * 0.11;
    nRestante = Math.max(0, N - nDoMap);
    itens.push({
      produto: "MAP",
      formula: "11-52-00",
      kg_ha: Math.round(kgMap),
      obs: `fornece ~${Math.round(nDoMap)} kg de N`,
    });
  }
  if (nRestante > 0) {
    itens.push({ produto: "Ureia", formula: "45-00-00", kg_ha: Math.round(nRestante / 0.45) });
  }
  if (k2o > 0) {
    itens.push({ produto: "Cloreto de potássio (KCl)", formula: "00-00-60", kg_ha: Math.round(k2o / 0.6) });
  }
  if (s > 0) {
    itens.push({ produto: "Gesso agrícola", formula: "~15% S, 16% Ca", kg_ha: Math.round(s / 0.15) });
  }
  return itens;
}

function escalar(kg_ha: number, areaHa: number | null): { kg_total: number | null; sacas_50: number | null } {
  if (areaHa === null || areaHa <= 0) return { kg_total: null, sacas_50: null };
  const total = kg_ha * areaHa;
  return { kg_total: Math.round(total), sacas_50: Math.round((total / 50) * 10) / 10 };
}

/**
 * Escolhe o MELHOR formulado NPK para a recomendação e dimensiona para a área.
 * Critério: dosar o formulado para entregar todo o N (nutriente que comanda o
 * café) e escolher aquele que menos desperdiça K (excesso pesa mais que falta,
 * pois a falta é completada com KCl). P e S entram como complemento. Resultado
 * em kg/ha e no total do talhão (kg e sacas de 50 kg).
 */
export function sugerirFormulacao(
  n: Recomendacao5a["necessidade_nutrientes"],
  areaHa: number | null,
): FormulacaoPlano {
  const N = num(n.N_kg_ha_ano);
  const K = num(n.K2O_kg_ha_ano) ?? 0;
  const P = num(n.P2O5_kg_ha_ano) ?? 0;
  const S = num(n.S_kg_ha_ano) ?? 0;
  const observacoes: string[] = [];

  if (N === null || N <= 0) {
    return {
      area_ha: areaHa,
      principal: null,
      complementos: [],
      observacoes: ["Sem dose de N calculada para esta fase — a formulação NPK não se aplica aqui."],
    };
  }

  // Escolhe, no catálogo comercial, o formulado que melhor cobre o N sem
  // desperdiçar K; premia o S entregue (evita gesso) e desempata pelo preço.
  const candidatos = FORMULAS_TURBO.filter((f) => f.n > 0);
  let melhor = candidatos[0];
  let melhorScore = Infinity;
  for (const f of candidatos) {
    const dose = N / (f.n / 100); // kg/ha para entregar todo o N
    const kSup = (dose * f.k) / 100;
    const pSup = (dose * f.p) / 100;
    const sSup = (dose * f.s) / 100;
    const excessoK = Math.max(0, kSup - K);
    const faltaK = Math.max(0, K - kSup);
    let score = excessoK * 2 + faltaK + Math.abs(pSup - P) * 0.5;
    if (S > 0) score -= Math.min(sSup, S) * 0.05; // recompensa cobrir o S
    // Desempate por concentração: menos quilos de produto para a mesma dose.
    score += dose / 1e7;
    if (score < melhorScore) {
      melhorScore = score;
      melhor = f;
    }
  }

  const dose = N / (melhor.n / 100);
  const doseKgHa = Math.round(dose);
  const esc = escalar(doseKgHa, areaHa);
  const principal: FormulacaoItem = {
    produto: melhor.produto,
    formula: melhor.formula,
    codigo: melhor.codigo,
    kg_ha: doseKgHa,
    kg_total: esc.kg_total,
    sacas_50: esc.sacas_50,
    obs: `entrega os ${Math.round(N)} kg de N`,
  };

  const kSup = (dose * melhor.k) / 100;
  const pSup = (dose * melhor.p) / 100;
  const sSup = (dose * melhor.s) / 100;
  const complementos: FormulacaoItem[] = [];

  const faltaK = Math.max(0, K - kSup);
  if (faltaK >= 1) {
    const kgKcl = Math.round(faltaK / 0.6);
    const e = escalar(kgKcl, areaHa);
    complementos.push({
      produto: "Cloreto de potássio (KCl)",
      formula: "00-00-60",
      kg_ha: kgKcl,
      kg_total: e.kg_total,
      sacas_50: e.sacas_50,
      obs: `completa ${Math.round(faltaK)} kg de K₂O`,
    });
  }
  if (kSup - K > 5) {
    observacoes.push(`O formulado ${melhor.formula} entrega ~${Math.round(kSup)} kg de K₂O — acima dos ${Math.round(K)} recomendados. Considere um formulado com menos K.`);
  }

  const faltaP = Math.max(0, P - pSup);
  if (faltaP >= 1) {
    const kgMap = Math.round(faltaP / 0.52);
    const e = escalar(kgMap, areaHa);
    complementos.push({
      produto: "MAP",
      formula: "11-52-00",
      kg_ha: kgMap,
      kg_total: e.kg_total,
      sacas_50: e.sacas_50,
      obs: `completa ${Math.round(faltaP)} kg de P₂O₅`,
    });
  }

  // O S do próprio formulado abate a necessidade — só complementa o que faltar.
  const faltaS = Math.max(0, S - sSup);
  if (faltaS >= 1) {
    const kgGesso = Math.round(faltaS / 0.15);
    const e = escalar(kgGesso, areaHa);
    complementos.push({
      produto: "Gesso agrícola",
      formula: "~15% S, 16% Ca",
      kg_ha: kgGesso,
      kg_total: e.kg_total,
      sacas_50: e.sacas_50,
      obs: `completa ${Math.round(faltaS)} kg de S`,
    });
  } else if (S > 0 && sSup > 0) {
    observacoes.push(`O formulado ${melhor.formula} já entrega ~${Math.round(sSup)} kg de S — dispensa o gesso para enxofre.`);
  }

  observacoes.push("Parcele o formulado (N e K) em 3–4 vezes de outubro a março. Uma fonte é sugestão — o responsável técnico pode trocar por outro formulado equivalente.");

  return { area_ha: areaHa, principal, complementos, observacoes };
}

// Soma os produtos (principal + complementos) de vários talhões numa lista de
// compras única, agrupando por produto/fórmula. Ignora itens sem kg total.
export function agregarCompras(planos: FormulacaoPlano[]): FormulacaoItem[] {
  const acc = new Map<string, FormulacaoItem>();
  for (const plano of planos) {
    const itens = [plano.principal, ...plano.complementos];
    for (const it of itens) {
      if (!it || it.kg_total === null) continue;
      const chave = `${it.formula}|${it.produto}`;
      const atual = acc.get(chave);
      if (atual) {
        atual.kg_total = (atual.kg_total ?? 0) + it.kg_total;
        atual.sacas_50 = Math.round((((atual.sacas_50 ?? 0) + (it.sacas_50 ?? 0))) * 10) / 10;
      } else {
        acc.set(chave, { ...it, kg_ha: 0 }); // kg_ha não faz sentido no agregado
      }
    }
  }
  return [...acc.values()].sort((a, b) => (b.kg_total ?? 0) - (a.kg_total ?? 0));
}
