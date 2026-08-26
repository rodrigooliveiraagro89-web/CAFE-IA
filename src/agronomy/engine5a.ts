/**
 * Motor de recomendação de nutrientes para café arábica — 5ª Aproximação de
 * Minas Gerais + Manual do Café (Emater-MG). Transcreve as tabelas e regras da
 * base técnica AGRYN/YaCafé. Lógica PURA e auditável: as saídas são em NUTRIENTE
 * (N, P2O5, K2O, Ca, Mg, S, micros) antes da conversão para fertilizantes.
 *
 * Cobre TODAS as fases da lavoura (implantação, pós-plantio, formação 1º/2º ano,
 * recepa e esqueletamento 1º ano, produção). As fases de campo trabalham em
 * g/planta e g/cova; o motor converte para kg/ha quando a população é informada.
 *
 * Não substitui o parecer do responsável técnico. Toda faixa e dose vem de
 * constante nomeada, com as travas de segurança da seção 14 do documento.
 */

import { FORMULAS_TURBO } from "../domain/formulasTurbo";
import { calcularIndices, num, round } from "./core";
import type {
  ClasseGeral,
  ClasseMicro,
  DosesPorPlanta,
  ExtratorB,
  ExtratorMetalico,
  Fase,
  FertilizanteItem,
  Foliar,
  FormulacaoItem,
  FormulacaoPlano,
  Lavoura,
  MicroFonte,
  MicroSaida,
  ParcelaAdubacao,
  Recomendacao5a,
  Solo0a20,
  Solo20a40,
} from "./types";

// Versão das regras do motor 5ª Aproximação. Suba a versão sempre que uma faixa,
// dose ou fórmula do cálculo mudar — o histórico salvo carrega esta âncora.
export const REGRA_5A_VERSAO = "5a-mg-2026-v1";
export const REGRA_5A_FONTE = "5ª Aproximação de Minas Gerais + Manual do Café (Emater-MG)";
export const CATALOGO_VERSAO = "campanha-turbo-2026-08";

export const FASE_LABEL: Record<Fase, string> = {
  implantacao: "Implantação (cova/sulco)",
  pos_plantio: "Pós-plantio (pegamento)",
  formacao_1_ano: "Formação — 1º ano",
  formacao_2_ano: "Formação — 2º ano",
  recepado_1_ano: "Recepa — 1º ano",
  esqueletado_1_ano: "Esqueletamento — 1º ano",
  producao: "Lavoura em produção",
};

// -------------------------------------------------- classificações gerais ----

// Classifica por limites superiores [mb, b, m, bom]; acima do último = muito_bom.
function classeGeral(value: number | null, lim: [number, number, number, number]): ClasseGeral | null {
  if (value === null) return null;
  if (value <= lim[0]) return "muito_baixo";
  if (value <= lim[1]) return "baixo";
  if (value <= lim[2]) return "medio";
  if (value <= lim[3]) return "bom";
  return "muito_bom";
}

// Seção 2 — classes gerais do complexo de troca.
const LIM_MO: [number, number, number, number] = [0.7, 2.0, 4.0, 7.0];
const LIM_CA: [number, number, number, number] = [0.4, 1.2, 2.4, 4.0];
const LIM_MG: [number, number, number, number] = [0.15, 0.45, 0.9, 1.5];
const LIM_T: [number, number, number, number] = [1.6, 4.3, 8.6, 15.0];
const LIM_V: [number, number, number, number] = [20, 40, 60, 80];

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
type MicroFaixa = { lim: [number, number, number]; doses: [number, number, number, number] };
const MICRO_B: Record<ExtratorB, MicroFaixa> = {
  mehlich1: { lim: [0.3, 0.7, 1.0], doses: [3, 2, 1, 0] },
  hcl: { lim: [0.3, 0.7, 1.0], doses: [3, 2, 1, 0] },
  agua_quente: { lim: [0.2, 0.4, 0.6], doses: [3, 2, 1, 0] },
};
const MICRO_CU: Record<ExtratorMetalico, MicroFaixa> = {
  mehlich1: { lim: [0.5, 1.0, 1.5], doses: [3, 2, 1, 0] },
  dtpa: { lim: [0.3, 0.6, 1.0], doses: [3, 2, 1, 0] },
};
const MICRO_MN: Record<ExtratorMetalico, MicroFaixa> = {
  mehlich1: { lim: [5.0, 10.0, 15.0], doses: [15, 10, 5, 0] },
  dtpa: { lim: [1.0, 2.5, 5.0], doses: [15, 10, 5, 0] },
};
const MICRO_ZN: Record<ExtratorMetalico, MicroFaixa> = {
  mehlich1: { lim: [2.0, 4.0, 6.0], doses: [6, 4, 2, 0] },
  dtpa: { lim: [0.6, 1.1, 1.5], doses: [6, 4, 2, 0] },
};

function classeMicro(value: number, lim: [number, number, number]): { classe: ClasseMicro; idx: number } {
  if (value <= lim[0]) return { classe: "baixo", idx: 0 };
  if (value <= lim[1]) return { classe: "medio", idx: 1 };
  if (value <= lim[2]) return { classe: "adequado", idx: 2 };
  return { classe: "alto", idx: 3 };
}

function avaliarMicro(value: number | null, extrator: string | null | undefined, faixa: MicroFaixa | undefined): MicroSaida {
  // Trava 14.2: sem extrator ou sem valor, não é calculável automaticamente.
  if (value === null || !extrator || !faixa) return { classe: null, dose_kg_ha: null };
  const { classe, idx } = classeMicro(value, faixa.lim);
  return { classe, dose_kg_ha: faixa.doses[idx] };
}

// -------------------------------------------------------------- calagem ------

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

export function gessagemIndicada(sub: Solo20a40 | null | undefined): boolean {
  if (!sub) return false;
  const Ca = num(sub.Ca_cmolc_dm3);
  const Al = num(sub.Al_cmolc_dm3);
  const m = num(sub.m_percentual);
  return (Ca !== null && Ca <= 0.4) || (Al !== null && Al > 0.5) || (m !== null && m > 30);
}

// --------------------------------------------- N, K2O, P2O5 em produção ------

// Índice da faixa de produtividade (sc/ha): <20,20–30,30–40,40–50,50–60,>60.
function faixaProdutividade(sc: number): number {
  if (sc < 20) return 0;
  if (sc <= 30) return 1;
  if (sc <= 40) return 2;
  if (sc <= 50) return 3;
  if (sc <= 60) return 4;
  return 5;
}

// Seção 8 — N (kg/ha/ano): colunas [Nf<2,5 | 2,6–3,0 | 3,1–3,5 | sem análise].
const N_PRODUCAO: number[][] = [
  [200, 140, 80, 200],
  [250, 175, 110, 250],
  [300, 220, 140, 300],
  [350, 260, 170, 350],
  [400, 300, 200, 400],
  [450, 340, 230, 450],
];
// Seção 8 — K2O (kg/ha/ano): colunas [K<60 | 60–120 | 120–200 | >200].
const K2O_PRODUCAO: number[][] = [
  [150, 100, 0, 0],
  [190, 125, 0, 0],
  [225, 150, 0, 0],
  [260, 175, 50, 0],
  [300, 200, 75, 0],
  [340, 225, 100, 0],
];
// Seção 9 — P2O5 (kg/ha/ano): colunas por classe [MB | B | M | Bom | MuitoBom].
const P2O5_PRODUCAO: number[][] = [
  [30, 20, 10, 0, 0],
  [40, 30, 20, 0, 0],
  [50, 40, 25, 0, 0],
  [60, 50, 30, 15, 0],
  [70, 55, 35, 18, 0],
  [80, 60, 40, 20, 0],
];

function colunaNfoliar(nFoliar: number | null): number {
  if (nFoliar === null) return 3; // sem análise
  if (nFoliar < 2.5) return 0;
  if (nFoliar <= 3.0) return 1;
  return 2; // 3,1–3,5 (e acima, com regra de cancelamento de parcelas)
}

// Coluna da tabela por classe de K (mg/dm³). Retorna -1 quando o K é
// desconhecido — o K2O NÃO é calculado (não assumir solo rico).
function colunaK(Kmg: number | null): number {
  if (Kmg === null) return -1;
  if (Kmg < 60) return 0;
  if (Kmg <= 120) return 1;
  if (Kmg <= 200) return 2;
  return 3;
}

const CLASSE_P_INDEX: Record<ClasseGeral, number> = {
  muito_baixo: 0,
  baixo: 1,
  medio: 2,
  bom: 3,
  muito_bom: 4,
};

// -------------------------------------- N, K2O g/planta (fases de campo) -----

// N por planta e por APLICAÇÃO (seções 5.2/6/7). Multiplicar por nº de parcelas.
const N_G_PLANTA_APLIC: Record<Fase, number | null> = {
  implantacao: null,
  pos_plantio: 4, // 3–5 g/planta/aplicação
  formacao_1_ano: 10,
  formacao_2_ano: 20,
  recepado_1_ano: 20, // = 2º ano de formação
  esqueletado_1_ano: 20,
  producao: null,
};

// K2O por planta e por ANO (g/planta/ano) por classe de K [<60 | 60–120 | 120–200 | >200].
const K2O_G_PLANTA_ANO: Record<Fase, [number, number, number, number] | null> = {
  implantacao: null,
  pos_plantio: [30, 20, 10, 0],
  formacao_1_ano: [40, 20, 10, 0],
  formacao_2_ano: [60, 40, 20, 0],
  recepado_1_ano: [60, 40, 20, 0],
  esqueletado_1_ano: [60, 40, 20, 0],
  producao: null,
};

// Nº de parcelas de N sugerido por fase (o RT pode ajustar).
const PARCELAS_PADRAO: Record<Fase, number> = {
  implantacao: 1,
  pos_plantio: 4, // do pegamento ao fim das chuvas, a cada 30–45 dias
  formacao_1_ano: 3,
  formacao_2_ano: 3,
  recepado_1_ano: 3,
  esqueletado_1_ano: 3,
  producao: 4,
};

// Seção 5.1 — dose de P2O5 na cova por classe de P (implantação), g/cova.
const P2O5_COVA_G: Record<ClasseGeral, number> = {
  muito_baixo: 80,
  baixo: 65,
  medio: 50,
  bom: 35,
  muito_bom: 20,
};
const SULCO_FATOR = 2.5; // g/m de sulco = g/cova × 2,5

function gPlantaParaKgHa(gPorPlanta: number | null, plantasHa: number | null): number | null {
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
function boroPlantioGPlanta(classeB: ClasseMicro | null): number | null {
  if (classeB === "baixo") return 1.0;
  if (classeB === "medio") return 0.6;
  return classeB ? 0 : null;
}
function zincoPlantioGPlanta(classeZn: ClasseMicro | null): number | null {
  if (classeZn === "baixo") return 2.0;
  if (classeZn === "medio") return 1.0;
  return classeZn ? 0 : null;
}

// ----------------------------------------- conversão para fertilizantes ------


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

// ------------------------------------ melhor formulação para a área ----------


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

// ------------------------------------- cronograma de parcelamento ------------


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

// -------------------------------------- validação de faixas plausíveis -------
// Guarda-rail: sinaliza (NÃO trava) valores fora do plausível para solo de café,
// para o produtor conferir o laudo antes de confiar na dose. Laudos incompletos
// (campos ausentes) seguem funcionando — só valores absurdos geram aviso.
const FAIXA_PLAUSIVEL: { campo: keyof Solo0a20; nome: string; min: number; max: number }[] = [
  { campo: "pH_agua", nome: "pH", min: 3, max: 8.5 },
  { campo: "materia_organica_dag_kg", nome: "M.O. (dag/kg)", min: 0, max: 15 },
  { campo: "P_mg_dm3", nome: "P (mg/dm³)", min: 0, max: 800 },
  { campo: "P_rem_mg_L", nome: "P-rem (mg/L)", min: 0, max: 70 },
  { campo: "K_mg_dm3", nome: "K (mg/dm³)", min: 0, max: 2000 },
  { campo: "Ca_cmolc_dm3", nome: "Ca (cmolc)", min: 0, max: 30 },
  { campo: "Mg_cmolc_dm3", nome: "Mg (cmolc)", min: 0, max: 20 },
  { campo: "S_mg_dm3", nome: "S (mg/dm³)", min: 0, max: 300 },
  { campo: "argila_percentual", nome: "argila (%)", min: 0, max: 100 },
];

export function alertasFaixaPlausivel(solo: Solo0a20): string[] {
  const out: string[] = [];
  for (const f of FAIXA_PLAUSIVEL) {
    const v = num(solo[f.campo] as number | null | undefined);
    if (v !== null && (v < f.min || v > f.max)) {
      out.push(`Valor fora da faixa plausível: ${f.nome} = ${v} (esperado ${f.min}–${f.max}). Confira o laudo.`);
    }
  }
  return out;
}

// --------------------------------------------------------------- motor -------

export function recomendarNutrientes5a(input: {
  lavoura: Lavoura;
  solo: Solo0a20;
  sub?: Solo20a40 | null;
  foliar?: Foliar | null;
}): Recomendacao5a {
  const { lavoura, solo } = input;
  const fase = lavoura.fase;
  const idx = calcularIndices(solo);
  const alertas: string[] = [];
  const plantasHa = num(lavoura.plantas_ha);

  const classificacoes = {
    materia_organica: classeGeral(num(solo.materia_organica_dag_kg), LIM_MO),
    Ca: classeGeral(num(solo.Ca_cmolc_dm3), LIM_CA),
    Mg: classeGeral(num(solo.Mg_cmolc_dm3), LIM_MG),
    T: classeGeral(idx.T, LIM_T),
    V: classeGeral(idx.V_percentual, LIM_V),
    P: classificarP(num(solo.P_mg_dm3), num(solo.P_rem_mg_L), num(solo.argila_percentual)),
    S: classificarS(num(solo.S_mg_dm3), num(solo.P_rem_mg_L)),
    B: avaliarMicro(num(solo.B_mg_dm3), solo.extrator_B, solo.extrator_B ? MICRO_B[solo.extrator_B] : undefined).classe,
    Cu: avaliarMicro(num(solo.Cu_mg_dm3), solo.extrator_Cu, solo.extrator_Cu ? MICRO_CU[solo.extrator_Cu] : undefined).classe,
    Mn: avaliarMicro(num(solo.Mn_mg_dm3), solo.extrator_Mn, solo.extrator_Mn ? MICRO_MN[solo.extrator_Mn] : undefined).classe,
    Zn: avaliarMicro(num(solo.Zn_mg_dm3), solo.extrator_Zn, solo.extrator_Zn ? MICRO_ZN[solo.extrator_Zn] : undefined).classe,
  };

  const microB = avaliarMicro(num(solo.B_mg_dm3), solo.extrator_B, solo.extrator_B ? MICRO_B[solo.extrator_B] : undefined);
  const microCu = avaliarMicro(num(solo.Cu_mg_dm3), solo.extrator_Cu, solo.extrator_Cu ? MICRO_CU[solo.extrator_Cu] : undefined);
  const microMn = avaliarMicro(num(solo.Mn_mg_dm3), solo.extrator_Mn, solo.extrator_Mn ? MICRO_MN[solo.extrator_Mn] : undefined);
  const microZn = avaliarMicro(num(solo.Zn_mg_dm3), solo.extrator_Zn, solo.extrator_Zn ? MICRO_ZN[solo.extrator_Zn] : undefined);

  // Calagem e gessagem (independem da fase; sempre calculadas quando há dados).
  const calagem = calcularCalagem({
    T: idx.T,
    V: idx.V_percentual,
    Ve: lavoura.Ve_percentual,
    PRNT: lavoura.PRNT_percentual,
    superficie_coberta_percentual: lavoura.superficie_coberta_percentual,
    profundidade_correcao_cm: lavoura.profundidade_correcao_cm,
  });
  const gessagem = gessagemIndicada(input.sub);
  const gesso = doseGessagem(calagem.nc_prnt100, gessagem);
  const corretivo =
    calagem.nc_prnt100 !== null && calagem.nc_prnt100 > 0
      ? escolherCorretivo(classificacoes.Mg, idx.Ca_Mg_ratio)
      : null;

  // Macronutrientes por fase.
  let N: number | null = null;
  let K2O: number | null = null;
  let P2O5: number | null = null;
  let prodCalc: number | null = null;
  let doses: DosesPorPlanta | null = null;

  const Kmg = num(solo.K_mg_dm3);
  const colK = colunaK(Kmg);

  if (fase === "producao") {
    prodCalc = produtividadeCalculo(
      num(lavoura.produtividade_esperada_sc_ha),
      num(lavoura.produtividade_safra_anterior_sc_ha),
    );
    if (prodCalc !== null) {
      const linha = faixaProdutividade(prodCalc);
      N = N_PRODUCAO[linha][colunaNfoliar(num(input.foliar?.N_dag_kg))];
      K2O = colK < 0 ? null : K2O_PRODUCAO[linha][colK];
      if (colK < 0) alertas.push("Informe o teor de K do laudo (mg/dm³) para calcular o K2O.");
      const classP = classificacoes.P;
      P2O5 = classP ? P2O5_PRODUCAO[linha][CLASSE_P_INDEX[classP]] : null;
      if (!classP) alertas.push("Sem P-rem nem argila: P2O5 não calculado (informe um deles).");
    } else {
      alertas.push("Informe a produtividade esperada para calcular N, K2O e P2O5.");
    }
  } else if (fase === "implantacao") {
    // Implantação: P2O5 na cova (g/cova) por classe própria (seção 5.1).
    const classPImp = classificarPImplantacao(num(solo.P_mg_dm3), num(solo.P_rem_mg_L));
    const p2o5Cova = classPImp ? P2O5_COVA_G[classPImp] : null;
    if (!classPImp && num(solo.P_mg_dm3) !== null) {
      alertas.push("Implantação exige P-rem para a dose de P2O5 na cova (seção 5.1).");
    }
    doses = {
      N_g_planta_aplicacao: null,
      N_aplicacoes: null,
      K2O_g_planta_ano: null,
      P2O5_g_cova: p2o5Cova,
      P2O5_g_m_sulco: p2o5Cova !== null ? round(p2o5Cova * SULCO_FATOR, 0) : null,
      S_g_planta: 12, // se N/P não fornecerem S (seção 5.2)
      B_g_planta: boroPlantioGPlanta(classificacoes.B),
      Zn_g_planta: zincoPlantioGPlanta(classificacoes.Zn),
      plantas_ha: plantasHa,
    };
    alertas.push("Dose de P na cova/sulco; B e Zn só se o laudo indicar necessidade e houver mistura homogênea.");
  } else {
    // Pós-plantio / formação 1º e 2º ano / recepa / esqueletamento — g/planta.
    const nAplic = num(N_G_PLANTA_APLIC[fase]);
    const nParcelas = num(lavoura.numero_parcelamentos) ?? PARCELAS_PADRAO[fase];
    const k2oTab = K2O_G_PLANTA_ANO[fase];
    const k2oGPlanta = k2oTab && colK >= 0 ? k2oTab[colK] : null;
    const nAnualGPlanta = nAplic !== null ? nAplic * nParcelas : null;

    N = gPlantaParaKgHa(nAnualGPlanta, plantasHa);
    K2O = gPlantaParaKgHa(k2oGPlanta, plantasHa);
    // P2O5 dispensado na formação/recepa quando a cova foi bem feita (seção 6).
    P2O5 = null;

    doses = {
      N_g_planta_aplicacao: nAplic,
      N_aplicacoes: nAplic !== null ? nParcelas : null,
      K2O_g_planta_ano: k2oGPlanta,
      P2O5_g_cova: null,
      P2O5_g_m_sulco: null,
      S_g_planta: fase === "pos_plantio" ? 12 : null,
      B_g_planta: fase === "pos_plantio" ? boroPlantioGPlanta(classificacoes.B) : null,
      Zn_g_planta: fase === "pos_plantio" ? zincoPlantioGPlanta(classificacoes.Zn) : null,
      plantas_ha: plantasHa,
    };

    if (plantasHa === null) {
      alertas.push("Informe a população (plantas/ha) para converter as doses por planta em kg/ha.");
    }
    alertas.push("N é por aplicação; o total anual usa o nº de parcelas (padrão da fase). Parcele N e K no período chuvoso.");
    if (fase === "recepado_1_ano" || fase === "esqueletado_1_ano") {
      alertas.push("Recepa/esqueletamento: monitorar Zn nas brotações (diagnóstico foliar) e P2O5 pode ser dispensado se houve residual.");
    }
    if (fase === "formacao_2_ano") {
      alertas.push("Se houver perspectiva de colheita no 2º ano, migrar para as regras de lavoura em produção.");
    }
  }

  // Enxofre em kg/ha a partir do N recomendado (quando N em kg/ha é conhecido).
  const S = doseEnxofre(N, classificacoes.S);

  // Alerta de relação Ca:Mg fora de 3:1–5:1 (seção 3).
  if (idx.Ca_Mg_ratio !== null && (idx.Ca_Mg_ratio < 3 || idx.Ca_Mg_ratio > 5)) {
    alertas.push(`Relação Ca:Mg ${round(idx.Ca_Mg_ratio, 1)} fora da faixa 3:1–5:1 — considerar na escolha do corretivo.`);
  }

  // Sistema irrigado: aumentar parcelamentos, não a dose (trava 14.8).
  if (lavoura.sistema === "irrigado") {
    alertas.push("Lavoura irrigada: aumentar o número de parcelamentos, não a dose total (trava 14.8).");
  }

  // Guarda-rail de faixas plausíveis (avisa, não trava) — inclui CTC derivada.
  alertas.push(...alertasFaixaPlausivel(solo));
  if (idx.T !== null && (idx.T <= 0 || idx.T > 60)) {
    alertas.push(`CTC (T) implausível: ${round(idx.T, 1)} — confira Ca/Mg/K/H+Al do laudo.`);
  }
  if (idx.V_percentual !== null && (idx.V_percentual < 0 || idx.V_percentual > 100)) {
    alertas.push(`V% implausível: ${round(idx.V_percentual, 1)} — confira as bases e o H+Al.`);
  }

  // Travas de segurança (seção 14) e observações.
  if (num(solo.P_rem_mg_L) === null && num(solo.argila_percentual) === null) {
    alertas.push("Informe P-rem ou o teor de argila para classificar o fósforo (trava 14.1).");
  }
  for (const [nome, ext] of [
    ["B", solo.extrator_B],
    ["Cu", solo.extrator_Cu],
    ["Mn", solo.extrator_Mn],
    ["Zn", solo.extrator_Zn],
  ] as const) {
    if (num((solo as Record<string, number | null | undefined>)[`${nome}_mg_dm3`]) !== null && !ext) {
      alertas.push(`Informe o extrator do ${nome} para calcular o micronutriente (trava 14.2).`);
    }
  }
  if (classificacoes.Mn === "baixo" && num(solo.pH_agua) !== null && (solo.pH_agua as number) >= 6.0) {
    alertas.push("Mn baixo com pH alto: possível supercalagem — avaliar (trava 14.7).");
  }
  if (calagem.nc_prnt100 !== null && num(lavoura.PRNT_percentual) === null) {
    alertas.push("Informe o PRNT do calcário para a quantidade comercial exata (usado PRNT 95 padrão).");
  }
  alertas.push("Descontar nutrientes fornecidos por matéria orgânica, calcário, gesso e demais fontes.");
  alertas.push("Validar micronutrientes com análise foliar antes de reaplicar.");

  return {
    fase,
    fase_label: FASE_LABEL[fase],
    produtividade_calculo_sc_ha: prodCalc,
    indices: idx,
    classificacoes,
    necessidade_nutrientes: {
      N_kg_ha_ano: N,
      P2O5_kg_ha_ano: P2O5,
      K2O_kg_ha_ano: K2O,
      S_kg_ha_ano: S,
      B_kg_ha: microB.dose_kg_ha,
      Cu_kg_ha: microCu.dose_kg_ha,
      Mn_kg_ha: microMn.dose_kg_ha,
      Zn_kg_ha: microZn.dose_kg_ha,
    },
    doses_por_planta: doses,
    correcao_solo: {
      calagem_t_ha_prnt100: calagem.nc_prnt100,
      calagem_t_ha_produto: calagem.qc_produto,
      corretivo_sugerido: corretivo?.tipo ?? null,
      corretivo_motivo: corretivo?.motivo ?? null,
      gessagem_indicada: gessagem,
      gesso_t_ha: gesso.gesso_t_ha,
      gesso_ca_kg_ha: gesso.ca_kg_ha,
      gesso_s_kg_ha: gesso.s_kg_ha,
    },
    fontes_micros: fontesMicros({
      N_kg_ha_ano: N,
      P2O5_kg_ha_ano: P2O5,
      K2O_kg_ha_ano: K2O,
      S_kg_ha_ano: S,
      B_kg_ha: microB.dose_kg_ha,
      Cu_kg_ha: microCu.dose_kg_ha,
      Mn_kg_ha: microMn.dose_kg_ha,
      Zn_kg_ha: microZn.dose_kg_ha,
    }),
    alertas,
    regra: { versao: REGRA_5A_VERSAO, fonte: REGRA_5A_FONTE, catalogo: CATALOGO_VERSAO },
  };
}
