import { describe, expect, it } from "vitest";
import { renderSharedReportHtml } from "./sharedReport";
import { buildPropertyReport } from "./buildReport";
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

describe("renderSharedReportHtml", () => {
  it("gera um HTML autocontido com os dados da propriedade", () => {
    const report = buildPropertyReport(
      property(),
      [plot("A")],
      [],
      [ndvi("A", 0.6)],
      [],
      "2026-08-03T12:00:00Z",
    );
    const html = renderSharedReportHtml(report);

    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("Sítio São José");
    expect(html).toContain("Rodrigo Oliveira");
    expect(html).toContain("03/08/2026");
    expect(html).toContain("<style>"); // css inline, autocontido
    expect(html).toContain("noindex"); // não indexável por buscadores
  });

  it("escapa HTML dos campos para evitar quebra/injeção", () => {
    const report = buildPropertyReport(
      property({ name: "Sítio <b>X</b>", producer: 'A "&" B' }),
      [plot("A")],
      [],
      [],
      [],
      "2026-08-03T12:00:00Z",
    );
    const html = renderSharedReportHtml(report);

    expect(html).toContain("Sítio &lt;b&gt;X&lt;/b&gt;");
    expect(html).toContain("A &quot;&amp;&quot; B");
    expect(html).not.toContain("Sítio <b>X</b>");
  });
});
