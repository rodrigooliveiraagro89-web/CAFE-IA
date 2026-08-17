import { describe, expect, it } from "vitest";
import { safeFileName, toGeoJSON, toKML } from "./geoExport";
import type { Position } from "../features/ndvi/types";

const ring: Position[] = [
  [-46.99, -18.94],
  [-46.98, -18.94],
  [-46.98, -18.93],
];

describe("geoExport", () => {
  it("gera GeoJSON com polígono fechado", () => {
    const parsed = JSON.parse(toGeoJSON("Talhão 1", ring));
    expect(parsed.type).toBe("FeatureCollection");
    const coords = parsed.features[0].geometry.coordinates[0];
    // Fecha o anel: primeiro ponto repetido no fim.
    expect(coords[0]).toEqual(coords[coords.length - 1]);
    expect(parsed.features[0].properties.name).toBe("Talhão 1");
  });

  it("não duplica o ponto se o anel já vier fechado", () => {
    const closed: Position[] = [...ring, ring[0]];
    const coords = JSON.parse(toGeoJSON("x", closed)).features[0].geometry.coordinates[0];
    expect(coords).toHaveLength(4);
  });

  it("gera KML com coordenadas lng,lat,0 e nome com escape", () => {
    const kml = toKML("A & B", ring);
    expect(kml).toContain("<coordinates>-46.99,-18.94,0");
    expect(kml).toContain("A &amp; B");
  });

  it("safeFileName remove acentos e espaços", () => {
    expect(safeFileName("Talhão da Casa 1")).toBe("talhao-da-casa-1");
    expect(safeFileName("")).toBe("talhao");
  });
});
