import turfArea from "@turf/area";
import { describe, expect, it } from "vitest";
import {
  buildSentinelSearchBody,
  calculateNdvi,
  calculateNdviSeries,
  classifyNdvi,
  closePolygon,
  hasSufficientCoverage,
  polygonAreaHectares,
  responsibleInterpretation,
  summarizeNdvi,
  validCoveragePercentage,
} from "./domain";

describe("motor NDVI", () => {
  it("calcula Sentinel-2 e trata divisão por zero e pixels inválidos", () => {
    expect(calculateNdvi(0.72, 0.18)).toBeCloseTo(0.6, 8);
    expect(calculateNdvi(0, 0)).toBeNull();
    expect(calculateNdvi(Number.NaN, 0.2)).toBeNull();
    expect(calculateNdvi(-0.8, 0.1)).toBeNull();
  });

  it("exclui nuvens, sombras e NoData por máscara antes das estatísticas", () => {
    const ndvi = calculateNdviSeries(
      [0.7, 0.65, 0.5, Number.NaN, 0.2],
      [0.2, 0.25, 0.3, 0.1, 0.2],
      [false, true, false, false, true],
    );

    expect(ndvi).toHaveLength(5);
    expect(ndvi[0]).toBeCloseTo(0.5555, 3);
    expect(ndvi[1]).toBeNull();
    expect(ndvi[2]).toBeCloseTo(0.25, 3);
    expect(ndvi[3]).toBeNull();
    expect(ndvi[4]).toBeNull();
    expect(validCoveragePercentage(2, 5)).toBe(40);
    expect(hasSufficientCoverage(40)).toBe(false);
  });

  it("resume, classifica e conserva a área válida", () => {
    const values = [-0.1, 0.3, 0.5, 0.7, 0.9, null];
    const summary = summarizeNdvi(values);
    const classes = classifyNdvi(values, 12.5);

    expect(summary?.mean).toBeCloseTo(0.46, 8);
    expect(summary?.median).toBeCloseTo(0.5, 8);
    expect(classes.reduce((sum, item) => sum + item.hectares, 0)).toBeCloseTo(12.5, 8);
    expect(classes.reduce((sum, item) => sum + item.percentage, 0)).toBeCloseTo(100, 8);
  });

  it("valida uma área agrícola de aproximadamente um hectare contra Turf", () => {
    // Quadrado de ~100 m × 100 m em Patrocínio (MG), apenas como área de validação.
    const geometry = closePolygon([
      [-46.9995, -18.9442],
      [-46.998551, -18.9442],
      [-46.998551, -18.943302],
      [-46.9995, -18.943302],
    ]);
    const agrynArea = polygonAreaHectares(geometry);
    const referenceArea = turfArea(geometry) / 10_000;

    expect(agrynArea).toBeGreaterThan(0.98);
    expect(agrynArea).toBeLessThan(1.03);
    expect(agrynArea).toBeCloseTo(referenceArea, 5);
  });

  it("produz uma busca STAC rastreável e uma leitura não diagnóstica", () => {
    const geometry = closePolygon([
      [-47, -19],
      [-46.99, -19],
      [-46.99, -18.99],
    ]);
    const query = buildSentinelSearchBody(geometry, "2026-05-01", "2026-07-18", 25);

    expect(query.collections).toEqual(["sentinel-2-l2a"]);
    expect(query.intersects).toEqual(geometry);
    expect(query.query["eo:cloud_cover"].lte).toBe(25);
    expect(responsibleInterpretation(52, 0.6)).toMatch(/insuficiente/i);
    expect(responsibleInterpretation(90, 0.58)).toMatch(/não diagnostica/i);
  });
});
