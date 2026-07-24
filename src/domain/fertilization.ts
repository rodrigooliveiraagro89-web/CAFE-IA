/**
 * Calagem e adubação NPK do café em produção — Boletim 100 (IAC).
 *
 * Princípio de governança do AGRYN: a IA apenas EXTRAI os números do laudo.
 * A recomendação é feita AQUI, por código determinístico e auditável, com as
 * tabelas oficiais declaradas como constantes nomeadas. Nada é "gerado"; tudo
 * é consulta de tabela + aritmética, e toda suposição é devolvida explicitamente
 * em `suposicoes` para aparecer no parecer.
 *
 * Base: Boletim Técnico 100 (IAC) — "Recomendações de Adubação e Calagem para o
 * Estado de São Paulo", capítulo do café. Aplica-se a café EM PRODUÇÃO (a partir
 * do 3º ano agrícola).
 */

// --- Conversões de unidade -------------------------------------------------
// O laudo no app guarda K em mg/dm³ e CTC em cmolc/dm³ (padrão dos laboratórios
// brasileiros), mas as tabelas do Boletim 100 usam mmolc/dm³. Converter é
// obrigatório: sem isso a dose de K sairia ~39x errada.

/** Massa equivalente do K⁺ (39,1 g/mol, valência 1) — 1 mmolc = 39,1 mg. */
const MASSA_EQUIVALENTE_K = 39.1;

export function kMgParaMmolc(kMgPorDm3: number): number {
  return kMgPorDm3 / MASSA_EQUIVALENTE_K;
}

export function cmolcParaMmolc(valorCmolc: number): number {
  return valorCmolc * 10;
}

// --- Calagem ---------------------------------------------------------------

/** Saturação por bases alvo para café, conforme Boletim 100. */
export const V_ALVO_CAFE = 60;
/** PRNT do calcário dolomítico da recomendação padrão. */
export const PRNT_PADRAO = 95;

export type CalagemInput = {
  /** CTC (T) em cmolc/dm³, como vem do laudo. */
  ctcCmolc: number;
  /** Saturação por bases atual (V%), em %. */
  vAtual: number;
  /** Poder relativo de neutralização total do calcário, em %. */
  prnt?: number;
  /** Saturação por bases alvo, em %. */
  vAlvo?: number;
};

export type CalagemResult = {
  /** Necessidade de calcário, em t/ha. Zero quando o V% já atingiu o alvo. */
  toneladasPorHectare: number;
  vAtual: number;
  vAlvo: number;
  prnt: number;
  /** true quando o solo já está no alvo e não precisa de calagem. */
  dispensada: boolean;
};

/**
 * NC (t/ha) = CTC(mmolc/dm³) × (V2 − V1) / (10 × PRNT)
 *
 * Com a CTC em cmolc/dm³ isso equivale a CTC(cmolc) × (V2 − V1) / PRNT, que é a
 * forma usada aqui. Conferência com o exemplo do Boletim 100:
 * CTC 85 mmolc/dm³ (8,5 cmolc), V1 42%, V2 60%, PRNT 95 → ~1,6 t/ha.
 */
export function calcularCalagem(input: CalagemInput): CalagemResult {
  const { ctcCmolc, vAtual } = input;
  const prnt = input.prnt ?? PRNT_PADRAO;
  const vAlvo = input.vAlvo ?? V_ALVO_CAFE;

  if (vAtual >= vAlvo) {
    return { toneladasPorHectare: 0, vAtual, vAlvo, prnt, dispensada: true };
  }

  const toneladasPorHectare = (ctcCmolc * (vAlvo - vAtual)) / prnt;

  return { toneladasPorHectare, vAtual, vAlvo, prnt, dispensada: false };
}

// --- Tabelas NPK do Boletim 100 -------------------------------------------
// Cada linha é uma faixa de produtividade esperada (kg/ha de café beneficiado);
// cada coluna é uma classe do teor no solo/folha.

/** Limites superiores das faixas de produtividade (kg/ha beneficiado). */
const FAIXAS_PRODUTIVIDADE = [600, 1200, 1800, 2400, 3600, 4800, Infinity];

/** N (kg/ha) — colunas: N foliar < 26 | 26–30 | > 30 g/kg. */
const TABELA_N = [
  [150, 100, 50],
  [180, 120, 70],
  [210, 140, 90],
  [240, 160, 110],
  [300, 200, 140],
  [360, 250, 170],
  [450, 300, 200],
];

/** P₂O₅ (kg/ha) — colunas: P resina 0–5 | 6–12 | 13–30 | > 30 mg/dm³. */
const TABELA_P = [
  [40, 20, 20, 0],
  [50, 30, 20, 0],
  [60, 40, 20, 0],
  [70, 50, 30, 0],
  [80, 60, 40, 20],
  [90, 70, 50, 30],
  [100, 80, 60, 40],
];

/** K₂O (kg/ha) — colunas: K trocável 0–0,7 | 0,8–1,5 | 1,6–3,0 | > 3,0 mmolc/dm³. */
const TABELA_K = [
  [150, 100, 50, 20],
  [180, 120, 70, 30],
  [210, 140, 90, 40],
  [240, 160, 110, 50],
  [300, 200, 140, 80],
  [360, 250, 170, 100],
  [450, 300, 200, 120],
];

function linhaProdutividade(produtividadeKgHa: number): number {
  const indice = FAIXAS_PRODUTIVIDADE.findIndex((limite) => produtividadeKgHa <= limite);
  return indice === -1 ? FAIXAS_PRODUTIVIDADE.length - 1 : indice;
}

function colunaNFoliar(nFoliar: number): number {
  if (nFoliar < 26) return 0;
  if (nFoliar <= 30) return 1;
  return 2;
}

function colunaP(pResina: number): number {
  if (pResina <= 5) return 0;
  if (pResina <= 12) return 1;
  if (pResina <= 30) return 2;
  return 3;
}

function colunaK(kMmolc: number): number {
  if (kMmolc <= 0.7) return 0;
  if (kMmolc <= 1.5) return 1;
  if (kMmolc <= 3.0) return 2;
  return 3;
}

// Colunas assumidas quando falta análise (classe média), conforme orientação do
// Boletim 100 — sempre acompanhadas de uma suposição explícita.
const COLUNA_PADRAO_N = 1; // N foliar 26–30 g/kg
const COLUNA_PADRAO_P = 1; // P resina 6–12 mg/dm³
const COLUNA_PADRAO_K = 1; // K 0,8–1,5 mmolc/dm³

/** Fração do N reposta como enxofre. Dispensável com S no solo > 10 mg/dm³. */
const FRACAO_S_SOBRE_N = 1 / 8;
const S_SOLO_SUFICIENTE = 10;

export type AdubacaoInput = {
  /** Produtividade esperada, em kg/ha de café beneficiado. */
  produtividadeKgHa: number;
  /** N foliar em g/kg, se houver análise foliar. */
  nFoliar?: number | null;
  /** P resina do laudo, em mg/dm³. */
  pResina?: number | null;
  /** K trocável do laudo, em mg/dm³ (convertido internamente para mmolc/dm³). */
  kMgPorDm3?: number | null;
  /** S do laudo, em mg/dm³. */
  sMgPorDm3?: number | null;
};

export type AdubacaoResult = {
  n: number;
  p2o5: number;
  k2o: number;
  /** Enxofre sugerido (kg/ha). Zero quando o solo já tem S suficiente. */
  s: number;
  /** Suposições feitas por falta de dado — devem aparecer no parecer. */
  suposicoes: string[];
};

export function recomendarAdubacao(input: AdubacaoInput): AdubacaoResult {
  const linha = linhaProdutividade(input.produtividadeKgHa);
  const suposicoes: string[] = [];

  let colunaN = COLUNA_PADRAO_N;
  if (input.nFoliar !== null && input.nFoliar !== undefined) {
    colunaN = colunaNFoliar(input.nFoliar);
  } else {
    suposicoes.push(
      "Sem análise foliar: N calculado pela classe adequada (26–30 g/kg). Faça a foliar para refinar.",
    );
  }

  let colunaPResina = COLUNA_PADRAO_P;
  if (input.pResina !== null && input.pResina !== undefined) {
    colunaPResina = colunaP(input.pResina);
  } else {
    suposicoes.push(
      "Sem P no laudo: P₂O₅ calculado pela classe média (6–12 mg/dm³).",
    );
  }

  let colunaKTrocavel = COLUNA_PADRAO_K;
  if (input.kMgPorDm3 !== null && input.kMgPorDm3 !== undefined) {
    colunaKTrocavel = colunaK(kMgParaMmolc(input.kMgPorDm3));
  } else {
    suposicoes.push(
      "Sem K no laudo: K₂O calculado pela classe média (0,8–1,5 mmolc/dm³).",
    );
  }

  const n = TABELA_N[linha][colunaN];
  const p2o5 = TABELA_P[linha][colunaPResina];
  const k2o = TABELA_K[linha][colunaKTrocavel];

  const temSSuficiente =
    input.sMgPorDm3 !== null &&
    input.sMgPorDm3 !== undefined &&
    input.sMgPorDm3 > S_SOLO_SUFICIENTE;

  return {
    n,
    p2o5,
    k2o,
    s: temSSuficiente ? 0 : Math.round(n * FRACAO_S_SOBRE_N),
    suposicoes,
  };
}

// --- Cenários de produtividade --------------------------------------------

export const SACA_KG = 60;

export type CenarioId = "baixa" | "media" | "alta";

export type Cenario = {
  id: CenarioId;
  label: string;
  /** Produtividade alvo em sacas/ha. */
  sacasPorHectare: number;
};

/** Cenários padrão do Boletim 100 (café beneficiado). */
export const CENARIOS: Cenario[] = [
  { id: "baixa", label: "Baixa", sacasPorHectare: 25 },
  { id: "media", label: "Média", sacasPorHectare: 45 },
  { id: "alta", label: "Alta", sacasPorHectare: 70 },
];

export function sacasParaKgHa(sacas: number): number {
  return sacas * SACA_KG;
}
