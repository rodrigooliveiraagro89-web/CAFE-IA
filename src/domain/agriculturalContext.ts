import { closePolygon, polygonAreaHectares } from "../features/ndvi/domain";
import type { GeoPolygon, Position } from "../features/ndvi/types";

export const cropOptions = [
  "Café",
  "Batata",
  "Milho",
  "Soja",
  "Morango",
  "Citros",
  "Feijão",
  "Trigo",
  "Cana-de-açúcar",
  "Hortaliças",
  "Outra cultura",
] as const;

// Estágios fenológicos comuns oferecidos como sugestão de toque no cadastro
// de talhão. Datalist: cobre as culturas mais usadas sem travar a digitação.
export const phenologicalStages = [
  "Formação",
  "Vegetativo",
  "Florescimento",
  "Frutificação",
  "Enchimento de grãos",
  "Granação",
  "Maturação",
  "Colheita",
  "Pós-colheita / repouso",
] as const;

// Gera as safras recentes (ex.: "2024/25") a partir de um ano de referência,
// para sugerir no campo de safra sem impedir outra digitação.
export function recentSeasons(reference: number, span = 4): string[] {
  const start = reference - 1;
  return Array.from({ length: span }, (_, index) => {
    const first = start + index;
    const second = String((first + 1) % 100).padStart(2, "0");
    return `${first}/${second}`;
  });
}

export type FarmProperty = {
  id: string;
  name: string;
  producer: string;
  responsible: string;
  city: string;
  state: string;
  createdAt: string;
};

export type FarmPlot = {
  id: string;
  propertyId: string;
  name: string;
  crop: string;
  variety: string;
  season: string;
  plantingDate: string;
  phenologicalStage: string;
  rowSpacing: string;
  plantSpacing: string;
  population: string;
  areaHectares: number;
  geometry: GeoPolygon | null;
  createdAt: string;
};

export type AgriculturalContextState = {
  properties: FarmProperty[];
  plots: FarmPlot[];
  selectedPropertyId: string;
  selectedPlotId: string;
};

export const emptyAgriculturalContext: AgriculturalContextState = {
  properties: [],
  plots: [],
  selectedPropertyId: "",
  selectedPlotId: "",
};

export type PropertyInput = Omit<FarmProperty, "id" | "createdAt">;
export type PlotInput = Omit<FarmPlot, "id" | "propertyId" | "createdAt">;

export function newId(prefix: string) {
  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${randomPart}`;
}

export function propertyLocation(property: FarmProperty) {
  return [property.city, property.state].filter(Boolean).join(" · ");
}

export function parsePlotBoundary(fileName: string, contents: string) {
  const extension = fileName.toLocaleLowerCase().split(".").pop();
  const geometry =
    extension === "kml" ? parseKmlPolygon(contents) : parseGeoJsonPolygon(contents);
  const areaHectares = polygonAreaHectares(geometry);

  if (areaHectares <= 0) {
    throw new Error("O arquivo não contém uma área agrícola válida.");
  }

  return { geometry, areaHectares };
}

export function parseGeoJsonPolygon(contents: string): GeoPolygon {
  let document: unknown;
  try {
    document = JSON.parse(contents);
  } catch {
    throw new Error("O arquivo GeoJSON não pôde ser lido.");
  }

  const candidate = extractGeometry(document);
  if (!candidate || candidate.type !== "Polygon" || !Array.isArray(candidate.coordinates)) {
    throw new Error("Envie um GeoJSON com uma geometria do tipo Polygon.");
  }

  const firstRing = candidate.coordinates[0];
  if (!Array.isArray(firstRing)) {
    throw new Error("O polígono do GeoJSON não possui coordenadas válidas.");
  }

  return closePolygon(normalizePositions(firstRing));
}

export function parseKmlPolygon(contents: string): GeoPolygon {
  const parser = new DOMParser();
  const document = parser.parseFromString(contents, "application/xml");
  if (document.querySelector("parsererror")) {
    throw new Error("O arquivo KML não pôde ser lido.");
  }

  const coordinatesText = document.querySelector("Polygon coordinates")?.textContent;
  if (!coordinatesText) {
    throw new Error("Envie um KML com uma geometria Polygon.");
  }

  const positions = coordinatesText
    .trim()
    .split(/\s+/)
    .map((coordinate) => coordinate.split(",").slice(0, 2).map(Number))
    .filter((coordinate) => coordinate.length === 2 && coordinate.every(Number.isFinite));

  return closePolygon(normalizePositions(positions));
}

function extractGeometry(value: unknown): { type?: string; coordinates?: unknown[] } | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.type === "FeatureCollection") {
    const features = Array.isArray(record.features) ? record.features : [];
    return extractGeometry(features[0]);
  }
  if (record.type === "Feature") return extractGeometry(record.geometry);
  return record as { type?: string; coordinates?: unknown[] };
}

function normalizePositions(values: unknown[]): Position[] {
  const positions = values
    .map((value) => (Array.isArray(value) ? value.slice(0, 2).map(Number) : []))
    .filter(
      (value): value is [number, number] =>
        value.length === 2 &&
        value.every(Number.isFinite) &&
        value[0] >= -180 &&
        value[0] <= 180 &&
        value[1] >= -90 &&
        value[1] <= 90,
    );

  if (positions.length < 3) {
    throw new Error("O limite precisa ter pelo menos três coordenadas válidas.");
  }
  return positions;
}
