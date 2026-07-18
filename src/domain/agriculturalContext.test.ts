import { describe, expect, it } from "vitest";
import { parseGeoJsonPolygon, parseKmlPolygon, parsePlotBoundary } from "./agriculturalContext";

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
