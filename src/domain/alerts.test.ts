import { describe, expect, it } from "vitest";
import { buildAlerts } from "./alerts";
import type { FarmPlot } from "./agriculturalContext";
import type { FieldRecord } from "./fieldRecords";
import type { NdviResult } from "../features/ndvi/types";
import type { SoilAnalysis } from "../features/soil/soilStore";

const HOJE = "2026-08-03";

function plot(id: string, name: string): FarmPlot {
  return {
    id,
    propertyId: "p1",
    name,
    crop: "Café arábica",
    season: "2026/27",
    plantingDate: "",
    phenologicalStage: "",
    rowSpacing: "",
    plantSpacing: "",
    population: "",
    areaHectares: 1,
    geometry: null,
  } as FarmPlot;
}

function record(over: Partial<FieldRecord>): FieldRecord {
  return {
    id: over.id ?? "r1",
    propertyId: "p1",
    plotId: "t1",
    type: "Adubação",
    title: "Adubação",
    date: "2026-07-01",
    notes: "",
    status: "planejada",
    cost: 0,
    quantity: "",
    unit: "",
    attachments: [],
    createdAt: "2026-07-01T00:00:00Z",
    ...over,
  };
}

function ndvi(plotId: string, acquiredAt: string, mean: number): NdviResult {
  return {
    id: `${plotId}-${acquiredAt}`,
    plotId,
    acquiredAt,
    statistics: { mean },
  } as NdviResult;
}

function soil(plotId: string, analysisDate: string): SoilAnalysis {
  return {
    id: `s-${plotId}-${analysisDate}`,
    plotId,
    analysisDate,
    laboratory: "LAB",
    source: "manual",
    values: {},
    createdAt: `${analysisDate}T00:00:00Z`,
  };
}

describe("buildAlerts — atividades atrasadas", () => {
  it("gera alerta alta quando há planejadas com data vencida", () => {
    const alerts = buildAlerts(
      [],
      [record({ status: "planejada", date: "2026-07-01" })],
      [],
      [],
      HOJE,
    );
    const atraso = alerts.find((a) => a.id === "atividades-atrasadas");
    expect(atraso?.severity).toBe("alta");
    expect(atraso?.title).toContain("1 atividade");
  });

  it("não conta atividades concluídas nem futuras", () => {
    const alerts = buildAlerts(
      [],
      [
        record({ id: "a", status: "concluida", date: "2026-07-01" }),
        record({ id: "b", status: "planejada", date: "2026-09-01" }),
      ],
      [],
      [],
      HOJE,
    );
    expect(alerts.find((a) => a.id === "atividades-atrasadas")).toBeUndefined();
  });
});

describe("buildAlerts — NDVI", () => {
  it("alerta de queda quando o vigor cai além do limiar entre as duas últimas cenas", () => {
    const alerts = buildAlerts(
      [plot("t1", "Talhão 1")],
      [],
      [ndvi("t1", "2026-08-01", 0.5), ndvi("t1", "2026-07-01", 0.62)],
      [soil("t1", "2026-07-15")],
      HOJE,
    );
    const queda = alerts.find((a) => a.id === "ndvi-queda-t1");
    expect(queda?.severity).toBe("alta");
    expect(queda?.detail).toContain("0.62");
  });

  it("não alerta queda quando a variação é pequena", () => {
    const alerts = buildAlerts(
      [plot("t1", "Talhão 1")],
      [],
      [ndvi("t1", "2026-08-01", 0.6), ndvi("t1", "2026-07-01", 0.63)],
      [soil("t1", "2026-07-15")],
      HOJE,
    );
    expect(alerts.find((a) => a.id === "ndvi-queda-t1")).toBeUndefined();
  });

  it("alerta de ausência quando o talhão nunca teve NDVI", () => {
    const alerts = buildAlerts([plot("t1", "Talhão 1")], [], [], [soil("t1", "2026-07-15")], HOJE);
    expect(alerts.find((a) => a.id === "ndvi-ausente-t1")?.severity).toBe("info");
  });

  it("alerta de desatualizado quando a última cena passou de 45 dias", () => {
    const alerts = buildAlerts(
      [plot("t1", "Talhão 1")],
      [],
      [ndvi("t1", "2026-06-01", 0.6)],
      [soil("t1", "2026-07-15")],
      HOJE,
    );
    expect(alerts.find((a) => a.id === "ndvi-desatualizado-t1")?.severity).toBe("media");
  });
});

describe("buildAlerts — solo", () => {
  it("alerta quando o talhão não tem laudo", () => {
    const alerts = buildAlerts(
      [plot("t1", "Talhão 1")],
      [],
      [ndvi("t1", "2026-08-01", 0.6)],
      [],
      HOJE,
    );
    expect(alerts.find((a) => a.id === "solo-ausente-t1")?.actionView).toBe("analise-solo");
  });

  it("alerta quando o laudo tem mais de 12 meses", () => {
    const alerts = buildAlerts(
      [plot("t1", "Talhão 1")],
      [],
      [ndvi("t1", "2026-08-01", 0.6)],
      [soil("t1", "2025-01-01")],
      HOJE,
    );
    expect(alerts.find((a) => a.id === "solo-vencido-t1")).toBeDefined();
  });

  it("não alerta quando o laudo é recente", () => {
    const alerts = buildAlerts(
      [plot("t1", "Talhão 1")],
      [],
      [ndvi("t1", "2026-08-01", 0.6)],
      [soil("t1", "2026-07-15")],
      HOJE,
    );
    expect(alerts.find((a) => a.id?.startsWith("solo-"))).toBeUndefined();
  });
});

describe("buildAlerts — ordenação", () => {
  it("coloca alertas de severidade alta antes dos demais", () => {
    const alerts = buildAlerts(
      [plot("t1", "Talhão 1")],
      [record({ status: "planejada", date: "2026-07-01" })],
      [],
      [soil("t1", "2026-07-15")],
      HOJE,
    );
    expect(alerts[0].severity).toBe("alta");
  });
});
