import { describe, expect, it } from "vitest";
import { buildPropertyReport, whatsappSummary, whatsappShareUrl } from "./buildReport";
import type { FarmPlot, FarmProperty } from "../../domain/agriculturalContext";
import type { NdviResult } from "../ndvi/types";

function property(over: Partial<FarmProperty> = {}): FarmProperty {
  return {
    id: "p1",
    name: "Sítio São José",
    producer: "Eduardo Caetano",
    responsible: "Rodrigo Oliveira",
    city: "Bueno Brandão",
    state: "MG",
    createdAt: "2026-01-01T00:00:00Z",
    ...over,
  } as FarmProperty;
}

function plot(id: string): FarmPlot {
  return {
    id,
    propertyId: "p1",
    name: `Talhão ${id}`,
    crop: "Café arábica",
    season: "2026/27",
    plantingDate: "",
    areaHectares: 2,
    geometry: null,
  } as FarmPlot;
}

function ndvi(plotId: string, mean: number): NdviResult {
  return {
    id: `${plotId}-1`,
    plotId,
    acquiredAt: "2026-07-20T00:00:00Z",
    statistics: { mean },
  } as NdviResult;
}

const GERADO = "2026-08-03T12:00:00Z";

describe("whatsappSummary", () => {
  it("monta um resumo com propriedade, produtor, talhões, NDVI e RT", () => {
    const report = buildPropertyReport(
      property(),
      [plot("A"), plot("B")],
      [],
      [ndvi("A", 0.6), ndvi("B", 0.5)],
      [],
      GERADO,
    );
    const texto = whatsappSummary(report);

    expect(texto).toContain("Sítio São José");
    expect(texto).toContain("Eduardo Caetano");
    expect(texto).toContain("Talhões avaliados: 2");
    expect(texto).toContain("NDVI médio: 0.55");
    expect(texto).toContain("Rodrigo Oliveira");
    expect(texto).toContain("03/08/2026");
  });

  it("indica ausência de NDVI quando nenhum talhão foi processado", () => {
    const report = buildPropertyReport(property(), [plot("A")], [], [], [], GERADO);
    expect(whatsappSummary(report)).toContain("NDVI: sem processamento");
  });

  it("omite produtor e RT quando não informados", () => {
    const report = buildPropertyReport(
      property({ producer: "", responsible: "" }),
      [plot("A")],
      [],
      [],
      [],
      GERADO,
    );
    const texto = whatsappSummary(report);
    expect(texto).not.toContain("Produtor:");
    expect(texto).not.toContain("Responsável técnico:");
  });

  it("gera um link wa.me com o texto codificado", () => {
    const report = buildPropertyReport(property(), [plot("A")], [], [ndvi("A", 0.6)], [], GERADO);
    const url = whatsappShareUrl(report);
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(url)).toContain("Sítio São José");
  });
});
