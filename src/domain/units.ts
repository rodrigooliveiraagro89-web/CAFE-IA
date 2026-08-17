/**
 * Unidades de área e distância — no padrão do produtor brasileiro, incluindo o
 * alqueire (que varia por região). Lógica pura e auditável: a área interna é
 * sempre em HECTARES (o que os módulos de geometria já devolvem) e a distância
 * em METROS; aqui só convertemos para exibição. Espelha o seletor de unidades
 * do FAMS, mas com as unidades que fazem sentido no Brasil.
 */

export type AreaUnit = "ha" | "m2" | "alq_paulista" | "alq_mineiro" | "acre";
export type DistanceUnit = "m" | "km";

// Metros quadrados por hectare e por cada unidade (fatores oficiais).
const M2_PER_HECTARE = 10_000;

const AREA_M2: Record<AreaUnit, number> = {
  ha: 10_000,
  m2: 1,
  alq_paulista: 24_200, // alqueire paulista = 2,42 ha
  alq_mineiro: 48_400, // alqueire mineiro/geométrico = 4,84 ha
  acre: 4_046.8564224,
};

export const AREA_UNITS: { id: AreaUnit; label: string; short: string }[] = [
  { id: "ha", label: "Hectare (ha)", short: "ha" },
  { id: "m2", label: "Metro quadrado (m²)", short: "m²" },
  { id: "alq_paulista", label: "Alqueire paulista", short: "alq. paul." },
  { id: "alq_mineiro", label: "Alqueire mineiro", short: "alq. min." },
  { id: "acre", label: "Acre", short: "acre" },
];

export const DISTANCE_UNITS: { id: DistanceUnit; label: string; short: string }[] = [
  { id: "m", label: "Metros (m)", short: "m" },
  { id: "km", label: "Quilômetros (km)", short: "km" },
];

/** Converte hectares para a unidade escolhida (valor numérico). */
export function areaInUnit(hectares: number, unit: AreaUnit): number {
  return (hectares * M2_PER_HECTARE) / AREA_M2[unit];
}

/** Casas decimais sensatas por unidade (m² não usa decimal; alqueire usa mais). */
function areaFractionDigits(unit: AreaUnit): number {
  if (unit === "m2") return 0;
  if (unit === "alq_paulista" || unit === "alq_mineiro") return 3;
  return 2;
}

/** Área formatada em pt-BR com a unidade curta (ex.: "3,42 ha"). */
export function formatArea(hectares: number, unit: AreaUnit): string {
  const value = areaInUnit(hectares, unit);
  const short = AREA_UNITS.find((u) => u.id === unit)?.short ?? "ha";
  return `${value.toLocaleString("pt-BR", {
    maximumFractionDigits: areaFractionDigits(unit),
  })} ${short}`;
}

/** Converte metros para a unidade de distância escolhida (valor numérico). */
export function distanceInUnit(meters: number, unit: DistanceUnit): number {
  return unit === "km" ? meters / 1_000 : meters;
}

/** Distância formatada em pt-BR (ex.: "1,25 km" ou "812 m"). */
export function formatDistance(meters: number, unit: DistanceUnit): string {
  const value = distanceInUnit(meters, unit);
  const short = unit === "km" ? "km" : "m";
  return `${value.toLocaleString("pt-BR", {
    maximumFractionDigits: unit === "km" ? 2 : 0,
  })} ${short}`;
}
