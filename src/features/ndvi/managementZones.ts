import type { NdviClass, NdviResult } from "./types";

export type ZoneLetter = "A" | "B" | "C" | "D" | "E";

export type ManagementZone = {
  letter: ZoneLetter;
  label: string;
  ndviMin: number;
  ndviMax: number;
  percentage: number;
  hectares: number;
  color: string;
  guidance: string;
};

// As zonas A–E consolidam as faixas absolutas de vigor devolvidas pelo
// backend (generalClasses, ids fixos em analysis.py::GENERAL_CLASSES). Cada
// zona lista os ids que agrupa, a faixa de NDVI, a cor e uma orientação
// QUALITATIVA de manejo. Nenhuma dose é sugerida aqui: doses só quando
// houver análise de solo vinculada (princípio de governança do AGRYN).
type ZoneDefinition = {
  letter: ZoneLetter;
  label: string;
  ndviMin: number;
  ndviMax: number;
  color: string;
  guidance: string;
  classIds: string[];
};

const ZONE_DEFINITIONS: ZoneDefinition[] = [
  {
    letter: "A",
    label: "Excelente",
    ndviMin: 0.65,
    ndviMax: 1,
    color: "#047857",
    guidance:
      "Vigor alto. Manter o manejo atual; adubação de manutenção conforme análise de solo.",
    classIds: ["alto", "muito-alto"],
  },
  {
    letter: "B",
    label: "Bom",
    ndviMin: 0.5,
    ndviMax: 0.65,
    color: "#22c55e",
    guidance:
      "Vigor adequado. Acompanhar a evolução e manter o programa nutricional em dia.",
    classIds: ["intermediario"],
  },
  {
    letter: "C",
    label: "Moderado",
    ndviMin: 0.35,
    ndviMax: 0.5,
    color: "#eab308",
    guidance:
      "Vigor moderado. Priorizar inspeção de campo; avaliar nutrição, água e pragas nesta área.",
    classIds: ["baixo"],
  },
  {
    letter: "D",
    label: "Fraco",
    ndviMin: 0.2,
    ndviMax: 0.35,
    color: "#d97706",
    guidance:
      "Atenção alta. Coletar análise de solo/folha dirigida a esta zona antes de qualquer correção.",
    classIds: ["muito-baixo"],
  },
  {
    letter: "E",
    label: "Crítico",
    ndviMin: 0,
    ndviMax: 0.2,
    color: "#8f4e2f",
    guidance:
      "Crítico. Investigar a causa em campo (falha de plantio, compactação, drenagem, praga) antes de intervir.",
    classIds: ["solo-exposto"],
  },
];

export const ZONES_SOIL_NOTE =
  "As zonas indicam o vigor relativo por área, não substituem laudo agronômico. Doses de adubo por zona só são geradas com análise de solo vinculada — princípio de governança do AGRYN.";

function classSource(result: NdviResult): NdviClass[] {
  // generalClasses são as faixas absolutas usadas pelas zonas; se ausente
  // (resultado antigo), cai para classes — mesmo fallback do NdviModule.
  if (result.generalClasses && result.generalClasses.length > 0) {
    return result.generalClasses;
  }
  return result.classes ?? [];
}

export function buildManagementZones(result: NdviResult): ManagementZone[] {
  const classes = classSource(result);
  const byId = new Map(classes.map((item) => [item.id, item]));

  return ZONE_DEFINITIONS.map((definition) => {
    const matched = definition.classIds
      .map((id) => byId.get(id))
      .filter((item): item is NdviClass => Boolean(item));
    const percentage = matched.reduce((sum, item) => sum + item.percentage, 0);
    const hectares = matched.reduce((sum, item) => sum + item.hectares, 0);
    return {
      letter: definition.letter,
      label: definition.label,
      ndviMin: definition.ndviMin,
      ndviMax: definition.ndviMax,
      color: definition.color,
      guidance: definition.guidance,
      percentage,
      hectares,
    };
  });
}

export function zonesDiagnosis(result: NdviResult): string {
  const zones = buildManagementZones(result);
  const covered = zones.filter((zone) => zone.percentage > 0);
  if (covered.length === 0) {
    return "Ainda não há pixels válidos suficientes para separar zonas de manejo.";
  }

  const dominant = covered.reduce((top, zone) =>
    zone.percentage > top.percentage ? zone : top,
  );
  const critical = zones
    .filter((zone) => (zone.letter === "D" || zone.letter === "E") && zone.percentage > 0)
    .reduce((sum, zone) => sum + zone.percentage, 0);

  const cv =
    result.statistics.coefficientOfVariation ??
    (result.statistics.mean > 0
      ? result.statistics.standardDeviation / result.statistics.mean
      : null);

  let variability: string;
  if (cv === null) {
    variability = "A variabilidade interna não pôde ser estimada";
  } else if (cv >= 0.25) {
    variability = "Variabilidade alta dentro do talhão — o manejo diferenciado por zona tende a compensar";
  } else if (cv >= 0.12) {
    variability = "Variabilidade média dentro do talhão";
  } else {
    variability = "Variabilidade baixa — o talhão está relativamente homogêneo";
  }

  const dominantText = `A zona predominante é ${dominant.letter} (${dominant.label}), com ${dominant.percentage.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}% da área.`;
  const criticalText =
    critical > 0
      ? ` Cerca de ${critical.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}% está em zonas de atenção (D/E) e merece vistoria dirigida.`
      : "";

  return `${variability}. ${dominantText}${criticalText}`;
}
