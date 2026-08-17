/**
 * Exportação de limites de talhão para os formatos abertos que o produtor usa
 * fora do app (Google Earth, QGIS, monitores de máquina): GeoJSON e KML. Puro
 * e testável — só monta strings a partir do anel de coordenadas [lng, lat].
 * Fecha o ciclo do IMPORTAR que o mapeamento já tinha.
 */

import type { Position } from "../features/ndvi/types";

/** Garante o anel fechado (primeiro ponto == último), como exigem GeoJSON/KML. */
function closedRing(ring: Position[]): Position[] {
  if (ring.length < 3) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return ring;
  return [...ring, first];
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** FeatureCollection com um único Polígono nomeado. */
export function toGeoJSON(name: string, ring: Position[]): string {
  const coordinates = [closedRing(ring).map(([lng, lat]) => [lng, lat])];
  const feature = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { name },
        geometry: { type: "Polygon", coordinates },
      },
    ],
  };
  return JSON.stringify(feature, null, 2);
}

/** KML com um Placemark de polígono (coordenadas lng,lat,0 separadas por espaço). */
export function toKML(name: string, ring: Position[]): string {
  const coords = closedRing(ring)
    .map(([lng, lat]) => `${lng},${lat},0`)
    .join(" ");
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(name)}</name>
    <Placemark>
      <name>${escapeXml(name)}</name>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${coords}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>
`;
}

/** Nome de arquivo seguro a partir do nome do talhão (sem acentos nem espaços). */
export function safeFileName(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return base || "talhao";
}
