import type {
  GeoPolygon,
  NdviClass,
  NdviScene,
  NdviStatistics,
  Position,
  StacItem,
} from "./types";

const EARTH_RADIUS_METERS = 6_371_008.8;
const EPSILON = 1e-12;

export const NDVI_CLASS_DEFINITIONS = [
  { id: "muito-baixo", label: "Muito baixo", color: "#8f4e2f", min: -1, max: 0.2 },
  { id: "baixo", label: "Baixo", color: "#d99b3d", min: 0.2, max: 0.4 },
  { id: "moderado", label: "Moderado", color: "#e4d34c", min: 0.4, max: 0.6 },
  { id: "alto", label: "Alto", color: "#74b84a", min: 0.6, max: 0.8 },
  { id: "muito-alto", label: "Muito alto", color: "#176b3a", min: 0.8, max: 1.0000001 },
] as const;

export function calculateNdvi(nir: number, red: number): number | null {
  if (!Number.isFinite(nir) || !Number.isFinite(red)) return null;

  const denominator = nir + red;
  if (Math.abs(denominator) <= EPSILON) return null;

  const value = (nir - red) / denominator;
  if (!Number.isFinite(value) || value < -1 || value > 1) return null;

  return value;
}

export function calculateNdviSeries(
  nirValues: readonly number[],
  redValues: readonly number[],
  invalidMask: readonly boolean[] = [],
): Array<number | null> {
  if (nirValues.length !== redValues.length) {
    throw new Error("As bandas NIR e vermelha precisam ter o mesmo número de pixels.");
  }

  return nirValues.map((nir, index) =>
    invalidMask[index] ? null : calculateNdvi(nir, redValues[index]),
  );
}

export function summarizeNdvi(values: readonly (number | null)[]): NdviStatistics | null {
  const validValues = values
    .filter((value): value is number => value !== null && Number.isFinite(value))
    .sort((left, right) => left - right);

  if (validValues.length === 0) return null;

  const mean = validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
  const midpoint = Math.floor(validValues.length / 2);
  const median =
    validValues.length % 2 === 0
      ? (validValues[midpoint - 1] + validValues[midpoint]) / 2
      : validValues[midpoint];
  const variance =
    validValues.reduce((sum, value) => sum + (value - mean) ** 2, 0) / validValues.length;

  return {
    mean,
    minimum: validValues[0],
    maximum: validValues[validValues.length - 1],
    median,
    standardDeviation: Math.sqrt(variance),
  };
}

export function classifyNdvi(
  values: readonly (number | null)[],
  validAreaHectares: number,
): NdviClass[] {
  const validValues = values.filter((value): value is number => value !== null);

  return NDVI_CLASS_DEFINITIONS.map((definition) => {
    const pixelCount = validValues.filter(
      (value) => value >= definition.min && value < definition.max,
    ).length;
    const percentage = validValues.length === 0 ? 0 : (pixelCount / validValues.length) * 100;

    return {
      ...definition,
      pixelCount,
      percentage,
      hectares: validAreaHectares * (percentage / 100),
    };
  });
}

export function validCoveragePercentage(validPixels: number, totalPixels: number): number {
  if (totalPixels <= 0 || validPixels < 0) return 0;
  return Math.min(100, (validPixels / totalPixels) * 100);
}

export function hasSufficientCoverage(
  validCoverage: number,
  minimumValidCoverage = 70,
): boolean {
  return validCoverage >= minimumValidCoverage;
}

export function closePolygon(points: readonly Position[]): GeoPolygon {
  if (points.length < 3) {
    throw new Error("O polígono precisa de pelo menos três vértices.");
  }

  const ring = [...points];
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);

  return { type: "Polygon", coordinates: [ring] };
}

export function polygonAreaHectares(polygon: GeoPolygon): number {
  const ring = polygon.coordinates[0];
  if (!ring || ring.length < 4) return 0;

  let accumulated = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const current = ring[index];
    const next = ring[index + 1];
    accumulated +=
      toRadians(next[0] - current[0]) *
      (2 + Math.sin(toRadians(current[1])) + Math.sin(toRadians(next[1])));
  }

  return Math.abs((accumulated * EARTH_RADIUS_METERS ** 2) / 2) / 10_000;
}

export function buildSentinelSearchBody(
  polygon: GeoPolygon,
  dateStart: string,
  dateEnd: string,
  maximumCloudCover: number,
) {
  return {
    collections: ["sentinel-2-l2a"],
    intersects: polygon,
    datetime: `${dateStart}T00:00:00Z/${dateEnd}T23:59:59Z`,
    limit: 50,
    query: {
      "eo:cloud_cover": {
        lte: maximumCloudCover,
      },
    },
    sortby: [
      { field: "properties.eo:cloud_cover", direction: "asc" },
      { field: "properties.datetime", direction: "desc" },
    ],
  };
}

export function normalizeStacItem(item: StacItem): NdviScene | null {
  const datetime = item.properties.datetime;
  if (!datetime) return null;

  const cloudValue = item.properties["eo:cloud_cover"];
  const platformValue = item.properties.platform ?? item.properties.constellation;
  const resolutionValue = item.properties.gsd;
  const thumbnail = Object.values(item.assets ?? {}).find((asset) => {
    const roles = asset.roles ?? [];
    return roles.includes("thumbnail") || asset.type?.startsWith("image/");
  });

  return {
    id: item.id,
    collection: item.collection ?? "sentinel-2-l2a",
    datetime,
    sceneCloudCover: typeof cloudValue === "number" ? cloudValue : null,
    platform: typeof platformValue === "string" ? platformValue : "Sentinel-2",
    resolutionMeters: typeof resolutionValue === "number" ? resolutionValue : 10,
    thumbnailUrl: thumbnail?.href ?? null,
    assets: item.assets ?? {},
  };
}

export function responsibleInterpretation(
  validCoverage: number,
  mean: number | null,
  previousMean?: number | null,
): string {
  if (!hasSufficientCoverage(validCoverage)) {
    return "A cobertura válida é insuficiente para uma leitura conclusiva. Procure outra data com menos nuvens antes de tomar decisões.";
  }

  if (mean === null) {
    return "Ainda não há pixels válidos suficientes para interpretar o índice.";
  }

  if (previousMean !== undefined && previousMean !== null) {
    const difference = mean - previousMean;
    if (difference <= -0.08) {
      return "Há uma queda relativa do vigor espectral em relação à data comparada. Confirme a área em campo e cruze com clima, solo, folhas e imagens.";
    }
    if (difference >= 0.08) {
      return "O vigor espectral aumentou na comparação. Use a tendência como apoio e confirme o contexto agronômico antes de concluir a causa.";
    }
  }

  return "O NDVI descreve vigor espectral relativo, não diagnostica isoladamente pragas, doenças ou deficiência nutricional. Confirme as zonas em campo.";
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}
