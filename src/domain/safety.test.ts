import { describe, expect, it } from "vitest";
import { evaluateRecommendationReadiness, type SoilAnalysisDraft } from "./safety";

const validAnalysis: SoilAnalysisDraft = {
  propertyId: "property-1",
  plotId: "plot-1",
  laboratory: "Laboratório Regional",
  sampledAt: "2026-07-15",
  pH: 5.7,
  organicMatter: 32,
  phosphorus: 14,
  potassium: 110,
  calcium: 3.2,
  magnesium: 1.1,
  cec: 8.4,
  baseSaturation: 61,
};

describe("evaluateRecommendationReadiness", () => {
  it("bloqueia recomendações quando não existe análise", () => {
    const result = evaluateRecommendationReadiness();
    expect(result.eligible).toBe(false);
    expect(result.message).toContain("bloqueada");
    expect(result.missing).toContain("pH");
  });

  it("libera somente um conjunto completo e plausível", () => {
    expect(evaluateRecommendationReadiness(validAnalysis).eligible).toBe(true);
  });

  it("bloqueia valores fora de faixas plausíveis", () => {
    const result = evaluateRecommendationReadiness({ ...validAnalysis, pH: 15 });
    expect(result.eligible).toBe(false);
    expect(result.invalid).toContain("pH");
  });
});
