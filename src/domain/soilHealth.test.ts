import { describe, expect, it } from "vitest";
import { computeSoilIndices, indexLabel } from "./soilHealth";
import type { SoilValues } from "./soilAnalysis";

describe("computeSoilIndices", () => {
  it("dá índices altos quando tudo está na faixa adequada", () => {
    const values: SoilValues = {
      ph: 6, // adequado (5,5–6,5)
      vPercent: 60, // adequado (50–70)
      p: 15, // adequado
      k: 80, // adequado
      ca: 3, // adequado
      mg: 0.8, // adequado
      s: 8, // adequado
      organicMatter: 3, // adequado
      mPercent: 5, // adequado (risco é alto)
    };
    const idx = computeSoilIndices(values);
    expect(idx.fertilidade).toBe(100);
    expect(idx.nutricional).toBe(100);
    expect(idx.sustentabilidade).toBe(100);
  });

  it("penaliza quando valores caem no lado de risco", () => {
    const values: SoilValues = {
      ph: 4.5, // baixo (risco)
      vPercent: 40, // baixo (risco)
      organicMatter: 1, // baixo (risco)
      mPercent: 30, // alto (risco)
    };
    const idx = computeSoilIndices(values);
    // pH e V% no risco → média 35 (CTC ausente é ignorado)
    expect(idx.fertilidade).toBe(35);
    expect(idx.sustentabilidade).toBe(35);
  });

  it("ignora CTC (informativo, sem faixa) no índice de fertilidade", () => {
    const values: SoilValues = { ph: 6, vPercent: 60, ctc: 8 };
    // só pH e V% contam, ambos adequados → 100
    expect(computeSoilIndices(values).fertilidade).toBe(100);
  });

  it("devolve null quando não há dado do grupo", () => {
    const idx = computeSoilIndices({ ph: 6 });
    expect(idx.nutricional).toBeNull();
    expect(idx.sustentabilidade).toBeNull();
    expect(idx.fertilidade).toBe(100); // só pH presente, adequado
  });

  it("dá nota intermediária quando o valor está fora mas não no lado de risco", () => {
    // Boro alto (risco é ser baixo) → 70, não 35
    const idx = computeSoilIndices({ b: 1.2 });
    expect(idx.nutricional).toBe(70);
  });
});

describe("indexLabel", () => {
  it("mapeia faixas para rótulos", () => {
    expect(indexLabel(null)).toBe("sem dados");
    expect(indexLabel(85)).toBe("ótimo");
    expect(indexLabel(65)).toBe("bom");
    expect(indexLabel(45)).toBe("atenção");
    expect(indexLabel(20)).toBe("crítico");
  });
});
