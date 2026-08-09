import { describe, expect, it } from "vitest";
import { buildTimeline, summarizeTimeline } from "./timeline";
import type { FieldRecord } from "./fieldRecords";
import type { NdviResult } from "../features/ndvi/types";
import type { SoilAnalysis } from "../features/soil/soilStore";

function record(over: Partial<FieldRecord>): FieldRecord {
  return {
    id: over.id ?? "r1",
    propertyId: "p1",
    plotId: "t1",
    type: "Adubação",
    title: "Adubação de cobertura",
    date: "2026-07-01",
    notes: "",
    status: "concluida",
    cost: 0,
    quantity: "",
    unit: "",
    attachments: [],
    createdAt: "2026-07-01T00:00:00Z",
    ...over,
  };
}

function ndvi(plotId: string, acquiredAt: string, mean: number): NdviResult {
  return { id: `${plotId}-${acquiredAt}`, plotId, acquiredAt, statistics: { mean } } as NdviResult;
}

function soil(plotId: string, analysisDate: string): SoilAnalysis {
  return {
    id: `s-${analysisDate}`,
    plotId,
    analysisDate,
    laboratory: "LAB",
    source: "pdf",
    values: { ph: 5.5, vPercent: 60 },
    createdAt: `${analysisDate}T00:00:00Z`,
  };
}

describe("buildTimeline", () => {
  it("reúne manejos, solo e NDVI num fio ordenado do mais recente ao mais antigo", () => {
    const events = buildTimeline(
      "t1",
      [record({ id: "a", date: "2026-06-10" })],
      [ndvi("t1", "2026-07-20", 0.61)],
      [soil("t1", "2026-07-05")],
    );
    expect(events).toHaveLength(3);
    expect(events.map((e) => e.date)).toEqual(["2026-07-20", "2026-07-05", "2026-06-10"]);
    expect(events.map((e) => e.kind)).toEqual(["ndvi", "solo", "manejo"]);
  });

  it("classifica colheita e custo pelos tipos do registro", () => {
    const events = buildTimeline(
      "t1",
      [
        record({ id: "c", type: "Colheita", title: "Colheita", date: "2026-08-01" }),
        record({ id: "d", type: "Custo", title: "Insumo", cost: 500, date: "2026-07-10" }),
      ],
      [],
      [],
    );
    expect(events.find((e) => e.id === "rec-c")?.kind).toBe("colheita");
    const custo = events.find((e) => e.id === "rec-d");
    expect(custo?.kind).toBe("custo");
    expect(custo?.detail).toContain("R$");
  });

  it("filtra por talhão — não mistura eventos de outro talhão", () => {
    const events = buildTimeline(
      "t1",
      [record({ id: "a", plotId: "t2", date: "2026-07-01" })],
      [ndvi("t2", "2026-07-20", 0.6)],
      [soil("t2", "2026-07-05")],
    );
    expect(events).toHaveLength(0);
  });

  it("mostra o vigor médio no detalhe do NDVI", () => {
    const events = buildTimeline("t1", [], [ndvi("t1", "2026-07-20", 0.615)], []);
    expect(events[0].detail).toContain("0.61");
  });
});

describe("summarizeTimeline", () => {
  it("conta eventos por tipo e soma o custo do talhão", () => {
    const records = [
      record({ id: "a", type: "Custo", cost: 500, date: "2026-07-10" }),
      record({ id: "b", type: "Colheita", cost: 0, date: "2026-08-01" }),
    ];
    const events = buildTimeline("t1", records, [ndvi("t1", "2026-07-20", 0.6)], []);
    const resumo = summarizeTimeline(events, records, "t1");

    expect(resumo.total).toBe(3);
    expect(resumo.porTipo.ndvi).toBe(1);
    expect(resumo.porTipo.colheita).toBe(1);
    expect(resumo.custoTotal).toBe(500);
    expect(resumo.primeiraData).toBe("2026-07-10");
    expect(resumo.ultimaData).toBe("2026-08-01");
  });

  it("lida com linha do tempo vazia", () => {
    const resumo = summarizeTimeline([], [], "t1");
    expect(resumo.total).toBe(0);
    expect(resumo.primeiraData).toBeNull();
  });
});
