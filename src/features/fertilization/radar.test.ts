import { describe, expect, it } from "vitest";
import { buildMacroRadar, buildMicroRadar, temDadosRadar } from "./radar";

describe("radar teor × adequado", () => {
  it("calcula % em relação ao adequado (P 30 vs adequado 15 = 200%)", () => {
    const macro = buildMacroRadar(
      { ph: 6, organicMatter: 3, k: 80 },
      { P_mg_dm3: 30, Ca_cmolc_dm3: 2.75, Mg_cmolc_dm3: 0.75, S_mg_dm3: 7.5 },
    );
    const p = macro.find((d) => d.label === "P");
    expect(p?.pct).toBeCloseTo(200, 0); // 30 / 15 × 100
    const ph = macro.find((d) => d.label === "pH");
    expect(ph?.pct).toBeCloseTo(100, 0); // 6 / 6
  });

  it("valores ausentes viram null (—)", () => {
    const micro = buildMicroRadar({ zn: 5 });
    const zn = micro.find((d) => d.label === "Zn");
    const fe = micro.find((d) => d.label === "Fe");
    expect(zn?.pct).toBeCloseTo(100, 0); // 5 / 5
    expect(fe?.pct).toBeNull();
    expect(fe?.valueLabel).toBe("—");
  });

  it("temDadosRadar exige ao menos 3 eixos preenchidos", () => {
    expect(temDadosRadar(buildMicroRadar({ zn: 5, b: 0.6 }))).toBe(false);
    expect(temDadosRadar(buildMicroRadar({ zn: 5, b: 0.6, cu: 1.2 }))).toBe(true);
  });
});
