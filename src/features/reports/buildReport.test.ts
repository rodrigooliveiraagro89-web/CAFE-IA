import { describe, expect, it } from "vitest";
import { buildPropertyReport, whatsappSummary, whatsappShareUrl } from "./buildReport";
import type { FarmPlot, FarmProperty } from "../../domain/agriculturalContext";
import type { NdviResult } from "../ndvi/types";
import type { SoilAnalysis } from "../soil/soilStore";

function soil(plotId: string): SoilAnalysis {
  // Casa 1 (Profert): P 12 mg/dm³, K 100 mg/dm³, CTC 7 cmolc, V% 41.
  return {
    id: `${plotId}-soil`,
    plotId,
    analysisDate: "2026-06-19",
    createdAt: "2026-06-19T00:00:00Z",
    source: "pdf",
    values: { p: 12, k: 100, s: 6.4, ctc: 7, vPercent: 41, ca: 18, mg: 5 },
  } as SoilAnalysis;
}

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

describe("bloco de adubação no relatório", () => {
  it("gera calagem, NPK e programa quando há laudo", () => {
    const report = buildPropertyReport(
      property(),
      [plot("A")],
      [],
      [],
      [soil("A")],
      GERADO,
    );
    const fert = report.plots[0].fertilizer;
    expect(fert).not.toBeNull();
    expect(fert?.calagemTHa).toBeGreaterThan(1); // V% 41 -> 60
    expect(fert?.npk.n).toBe(200); // média 45 sc, N foliar padrão
    expect(fert?.itens.length).toBeGreaterThan(0);
    expect(fert?.custoHa).toBeGreaterThan(0);
    // Proveniência carimbada com o laudo e a data de geração do relatório.
    expect(fert?.proveniencia.laudo?.id).toBe("A-soil");
    expect(fert?.proveniencia.geradoEm).toBe(GERADO);
  });

  it("respeita a fórmula escolhida por talhão", () => {
    const report = buildPropertyReport(
      property(),
      [plot("A")],
      [],
      [],
      [soil("A")],
      GERADO,
      { A: { cobertura: "200020", sacas: 45 } },
    );
    const fert = report.plots[0].fertilizer;
    // 20-00-20 entrega K em excesso com K alto no solo
    expect(fert?.kExcesso).toBe(true);
  });

  it("sem laudo, o bloco de adubação é nulo", () => {
    const report = buildPropertyReport(property(), [plot("A")], [], [], [], GERADO);
    expect(report.plots[0].fertilizer).toBeNull();
  });
});
