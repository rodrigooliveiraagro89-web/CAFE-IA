import {
  interpretSoil,
  type SoilFieldKey,
  type SoilInterpretationRow,
  type SoilValues,
} from "./soilAnalysis";

/**
 * Índices de saúde do solo (0–100) para os medidores do painel — a leitura
 * "de bater o olho" que o produtor entende na hora. São derivados da
 * interpretação determinística já existente (faixas CFSEMG/Boletim 100); não
 * inventamos nota: cada índice é a média das faixas dos nutrientes daquele
 * grupo. Quando não há dado suficiente, o índice é null (medidor "sem dados").
 */

export type SoilIndices = {
  fertilidade: number | null;
  nutricional: number | null;
  sustentabilidade: number | null;
};

// Cada grupo olha um conjunto de determinações do laudo.
const GRUPO_FERTILIDADE: SoilFieldKey[] = ["ph", "vPercent", "ctc"];
const GRUPO_NUTRICIONAL: SoilFieldKey[] = ["p", "k", "ca", "mg", "s", "zn", "b", "cu"];
const GRUPO_SUSTENTABILIDADE: SoilFieldKey[] = ["organicMatter", "mPercent"];

function pontuarLinha(row: SoilInterpretationRow): number | null {
  if (row.level === "informativo") return null; // sem faixa de referência (ex.: CTC)
  if (row.level === "adequado") return 100;
  if (row.level === row.riskySide) return 35; // caiu no lado de risco (ruim)
  // Extremo OPOSTO ao risco. Se o risco é "alto" (ex.: m% de alumínio), estar
  // baixo é o ideal (100). Se o risco é "baixo" (nutriente), estar alto é
  // excesso — só levemente indesejável (70).
  return row.riskySide === "alto" ? 100 : 70;
}

function indiceDoGrupo(rows: SoilInterpretationRow[], grupo: SoilFieldKey[]): number | null {
  const notas = rows
    .filter((row) => grupo.includes(row.key))
    .map(pontuarLinha)
    .filter((nota): nota is number => nota !== null);
  if (notas.length === 0) return null;
  return Math.round(notas.reduce((soma, nota) => soma + nota, 0) / notas.length);
}

export function computeSoilIndices(values: SoilValues): SoilIndices {
  const rows = interpretSoil(values);
  return {
    fertilidade: indiceDoGrupo(rows, GRUPO_FERTILIDADE),
    nutricional: indiceDoGrupo(rows, GRUPO_NUTRICIONAL),
    sustentabilidade: indiceDoGrupo(rows, GRUPO_SUSTENTABILIDADE),
  };
}

/** Rótulo qualitativo do índice, para acompanhar o número no medidor. */
export function indexLabel(value: number | null): string {
  if (value === null) return "sem dados";
  if (value >= 80) return "ótimo";
  if (value >= 60) return "bom";
  if (value >= 40) return "atenção";
  return "crítico";
}
