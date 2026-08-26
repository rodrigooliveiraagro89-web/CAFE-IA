import { describe, expect, it } from "vitest";
import { buildAssistantContext } from "./assistantContext";
import type { FarmPlot, FarmProperty } from "../../domain/agriculturalContext";
import type { SoilAnalysis } from "../soil/soilStore";

const property = { id: "p1", name: "Sítio São José", producer: "", responsible: "", city: "Bueno Brandão", state: "MG", createdAt: "" } as FarmProperty;
const plot = { id: "t1", propertyId: "p1", name: "Casa 1", crop: "Café arábica", variety: "Catuaí", season: "2026/27", areaHectares: 3.2, phenologicalStage: "Granação" } as FarmPlot;
const soil = {
  id: "s1", plotId: "t1", analysisDate: "2026-06-19", laboratory: "Profert", source: "pdf", createdAt: "",
  values: { ph: 4.66, p: 12, k: 231, ca: 18, mg: 5, s: 6.4, ctc: 7, vPercent: 41, b: 0.23 },
} as SoilAnalysis;

describe("buildAssistantContext", () => {
  it("resume talhão, laudo interpretado, calagem e NPK", () => {
    const ctx = buildAssistantContext({ property, plot, soil, ndviMean: 0.62, ndviDate: "2026-07-20", alerts: ["Sem monitoramento NDVI"] });
    expect(ctx).toContain("Casa 1");
    expect(ctx).toContain("Sítio São José");
    expect(ctx).toContain("Último laudo");
    expect(ctx).toContain("Calagem"); // V% 41 -> precisa de calcário
    expect(ctx).toContain("5ª Aproximação"); // fonte única: mesmo motor da tela
    expect(ctx).toContain("NDVI");
    expect(ctx).toContain("Alertas ativos");
  });

  it("sem talhão retorna vazio", () => {
    expect(buildAssistantContext({ property: null, plot: null, soil: null, ndviMean: null, ndviDate: null, alerts: [] })).toBe("");
  });

  it("sem laudo sinaliza a ausência", () => {
    const ctx = buildAssistantContext({ property, plot, soil: null, ndviMean: null, ndviDate: null, alerts: [] });
    expect(ctx).toContain("Sem laudo de solo");
  });
});
