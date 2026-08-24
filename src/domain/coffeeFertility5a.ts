/**
 * Motor de recomendação de nutrientes para café arábica — 5ª Aproximação de
 * Minas Gerais + Manual do Café (Emater-MG). Transcreve as tabelas e regras da
 * base técnica AGRYN/YaCafé. Lógica PURA e auditável: as saídas são em NUTRIENTE
 * (N, P2O5, K2O, S, micros) antes da conversão para fertilizantes comerciais.
 *
 * Não substitui o parecer do responsável técnico. Toda faixa e dose vem de
 * constante nomeada, com as travas de segurança da seção 14 do documento.
 */

// ------------------------------------------------------------------ tipos ----

export type Fase =
  | "implantacao"
  | "pos_plantio"
  | "formacao_1_ano"
  | "formacao_2_ano"
  | "esqueletado_1_ano"
  | "recepado_1_ano"
  | "producao";

export type ClasseGeral = "muito_baixo" | "baixo" | "medio" | "bom" | "muito_bom";
export type ClasseMicro = "baixo" | "medio" | "adequado" | "alto";

export type ExtratorB = "mehlich1" | "hcl" | "agua_quente";
export type ExtratorMetalico = "mehlich1" | "dtpa";

export type Solo0a20 = {
  pH_agua?: number | null;
  materia_organica_dag_kg?: number | null;
  P_mg_dm3?: number | null;
  P_rem_mg_L?: number | null;
  argila_percentual?: number | null;
  K_mg_dm3?: number | null;
  Ca_cmolc_dm3?: number | null;
  Mg_cmolc_dm3?: number | null;
  Al_cmolc_dm3?: number | null;
  H_Al_cmolc_dm3?: number | null;
  S_mg_dm3?: number | null;
  B_mg_dm3?: number | null;
  extrator_B?: ExtratorB | null;
  Cu_mg_dm3?: number | null;
  extrator_Cu?: ExtratorMetalico | null;
  Mn_mg_dm3?: number | null;
  extrator_Mn?: ExtratorMetalico | null;
  Zn_mg_dm3?: number | null;
  extrator_Zn?: ExtratorMetalico | null;
};

export type Solo20a40 = {
  Ca_cmolc_dm3?: number | null;
  Al_cmolc_dm3?: number | null;
  m_percentual?: number | null;
};

export type Foliar = {
  N_dag_kg?: number | null;
};

export type Lavoura = {
  fase: Fase;
  produtividade_esperada_sc_ha?: number | null;
  produtividade_safra_anterior_sc_ha?: number | null;
  Ve_percentual?: number | null; // alvo de saturação; padrão 60
  PRNT_percentual?: number | null;
  superficie_coberta_percentual?: number | null; // padrão 100
  profundidade_correcao_cm?: number | null; // padrão 20
};

export type MicroSaida = { classe: ClasseMicro | null; dose_kg_ha: number | null };

export type Recomendacao5a = {
  fase: Fase;
  produtividade_calculo_sc_ha: number | null;
  indices: {
    K_cmolc_dm3: number | null;
    SB: number | null;
    T: number | null;
    t: number | null;
    V_percentual: number | null;
    m_percentual: number | null;
  };
  classificacoes: {
    materia_organica: ClasseGeral | null;
    Ca: ClasseGeral | null;
    Mg: ClasseGeral | null;
    T: ClasseGeral | null;
    V: ClasseGeral | null;
    P: ClasseGeral | null;
    S: ClasseGeral | null;
    B: ClasseMicro | null;
    Cu: ClasseMicro | null;
    Mn: ClasseMicro | null;
    Zn: ClasseMicro | null;
  };
  necessidade_nutrientes: {
    N_kg_ha_ano: number | null;
    P2O5_kg_ha_ano: number | null;
    K2O_kg_ha_ano: number | null;
    S_kg_ha_ano: number | null;
    B_kg_ha: number | null;
    Cu_kg_ha: number | null;
    Mn_kg_ha: number | null;
    Zn_kg_ha: number | null;
  };
  correcao_solo: {
    calagem_t_ha_prnt100: number | null;
    calagem_t_ha_produto: number | null;
    gessagem_indicada: boolean;
  };
  alertas: string[];
};

// --------------------------------------------------------------- cálculos ----

const K_DIVISOR_CMOLC = 391; // K(mg/dm³)/391 = K(cmolc/dm³)

function num(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
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
  return { K_cmolc_dm3: K, SB, T, t, V_percentual: V, m_percentual: m };
}

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

function colunaK(Kmg: number | null): number {
  if (Kmg === null) return 3;
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

// ----------------------------------------- conversão para fertilizantes ------

export type FertilizanteItem = { produto: string; formula: string; kg_ha: number; obs?: string };

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

// --------------------------------------------------------------- motor -------

export function recomendarNutrientes5a(input: {
  lavoura: Lavoura;
  solo: Solo0a20;
  sub?: Solo20a40 | null;
  foliar?: Foliar | null;
}): Recomendacao5a {
  const { lavoura, solo } = input;
  const idx = calcularIndices(solo);
  const alertas: string[] = [];

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

  // Calagem e gessagem.
  const calagem = calcularCalagem({
    T: idx.T,
    V: idx.V_percentual,
    Ve: lavoura.Ve_percentual,
    PRNT: lavoura.PRNT_percentual,
    superficie_coberta_percentual: lavoura.superficie_coberta_percentual,
    profundidade_correcao_cm: lavoura.profundidade_correcao_cm,
  });
  const gessagem = gessagemIndicada(input.sub);

  // Macros em produção (N, K2O, P2O5) — só para lavoura em produção nesta versão.
  let N: number | null = null;
  let K2O: number | null = null;
  let P2O5: number | null = null;
  let prodCalc: number | null = null;

  if (lavoura.fase === "producao") {
    prodCalc = produtividadeCalculo(
      num(lavoura.produtividade_esperada_sc_ha),
      num(lavoura.produtividade_safra_anterior_sc_ha),
    );
    if (prodCalc !== null) {
      const linha = faixaProdutividade(prodCalc);
      N = N_PRODUCAO[linha][colunaNfoliar(num(input.foliar?.N_dag_kg))];
      K2O = K2O_PRODUCAO[linha][colunaK(num(solo.K_mg_dm3))];
      const classP = classificacoes.P;
      P2O5 = classP ? P2O5_PRODUCAO[linha][CLASSE_P_INDEX[classP]] : null;
      if (!classP) alertas.push("Sem P-rem nem argila: P2O5 não calculado (informe um deles).");
    } else {
      alertas.push("Informe a produtividade esperada para calcular N, K2O e P2O5.");
    }
  } else {
    alertas.push(
      "Fase diferente de produção: N/P/K seguem regras de implantação/formação/recepa (ainda não automatizadas aqui) — use a base técnica.",
    );
  }

  const S = doseEnxofre(N, classificacoes.S);

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
  if (calagem.nc_prnt100 !== null && (num(lavoura.PRNT_percentual) === null)) {
    alertas.push("Informe o PRNT do calcário para a quantidade comercial exata (usado PRNT 95 padrão).");
  }
  alertas.push("Descontar nutrientes fornecidos por matéria orgânica, calcário, gesso e demais fontes.");
  alertas.push("Validar micronutrientes com análise foliar antes de reaplicar.");

  return {
    fase: lavoura.fase,
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
    correcao_solo: {
      calagem_t_ha_prnt100: calagem.nc_prnt100,
      calagem_t_ha_produto: calagem.qc_produto,
      gessagem_indicada: gessagem,
    },
    alertas,
  };
}
