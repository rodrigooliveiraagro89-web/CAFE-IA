import { describe, expect, it } from "vitest";
import {
  isSharedProperty,
  parseGeoJsonPolygon,
  parseKmlPolygon,
  parsePlotBoundary,
  type FarmProperty,
} from "./agriculturalContext";

describe("isSharedProperty", () => {
  const base = { id: "p1", name: "Sítio", producer: "", responsible: "", city: "", state: "", createdAt: "" };
  it("é compartilhada quando o dono é outro usuário", () => {
    expect(isSharedProperty({ ...base, ownerId: "outro" } as FarmProperty, "eu")).toBe(true);
  });
  it("não é compartilhada quando o dono é o usuário atual", () => {
    expect(isSharedProperty({ ...base, ownerId: "eu" } as FarmProperty, "eu")).toBe(false);
  });
  it("não é compartilhada sem ownerId nem sem usuário", () => {
    expect(isSharedProperty(base as FarmProperty, "eu")).toBe(false);
    expect(isSharedProperty({ ...base, ownerId: "outro" } as FarmProperty, null)).toBe(false);
  });
});

const coordinates = [
  [-46.6, -21.2],
  [-46.599, -21.2],
  [-46.599, -21.199],
  [-46.6, -21.2],
];

describe("limites agrícolas", () => {
  it("lê GeoJSON Polygon e calcula uma área real", () => {
    const contents = JSON.stringify({
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [coordinates] },
      properties: {},
    });
    const result = parsePlotBoundary("talhao.geojson", contents);
    expect(result.geometry.coordinates[0]).toHaveLength(4);
    expect(result.areaHectares).toBeGreaterThan(0);
  });

  it("lê KML Polygon", () => {
    const geometry = parseKmlPolygon(`
      <kml><Placemark><Polygon><outerBoundaryIs><LinearRing>
        <coordinates>-46.6,-21.2,0 -46.599,-21.2,0 -46.599,-21.199,0 -46.6,-21.2,0</coordinates>
      </LinearRing></outerBoundaryIs></Polygon></Placemark></kml>
    `);
    expect(geometry.coordinates[0]).toHaveLength(4);
  });

  it("recusa arquivo sem polígono", () => {
    expect(() => parseGeoJsonPolygon('{"type":"Point","coordinates":[0,0]}')).toThrow(
      /Polygon/,
    );
  });
});
