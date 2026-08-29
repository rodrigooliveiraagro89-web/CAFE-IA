import { describe, expect, it } from "vitest";
import type { SoilValues } from "../../domain/soilAnalysis";
import { analysisToSolo, subFromValues } from "./soilToSolo";

describe("analysisToSolo", () => {
  it("converte unidades e deriva H+Al e Al quando não vêm no laudo", () => {
    const v = { ca: 20, mg: 8, k: 78.2, ph: 5.5, organicMatter: 25, p: 12, pRem: 30, argila: 40, s: 8, ctc: 4, mPercent: 10 } as SoilValues;
    const s = analysisToSolo(v);
    expect(s.Ca_cmolc_dm3).toBe(2); // 20 mmolc /10
    expect(s.Mg_cmolc_dm3).toBe(0.8); // 8 /10
    expect(s.K_mg_dm3).toBe(78.2); // K permanece em mg/dm3
    // SB = 2 + 0.8 + (78.2/391=0.2) = 3.0 ; H+Al = max(0, ctc 4 - 3) = 1
    expect(s.H_Al_cmolc_dm3).toBeCloseTo(1, 5);
    // Al = m% * SB / (100 - m%) = 10*3/90 = 0.3333
    expect(s.Al_cmolc_dm3).toBeCloseTo(0.3333, 3);
    // passthrough
    expect(s.pH_agua).toBe(5.5);
    expect(s.P_mg_dm3).toBe(12);
    expect(s.P_rem_mg_L).toBe(30);
    expect(s.argila_percentual).toBe(40);
    expect(s.S_mg_dm3).toBe(8);
  });

  it("respeita H+Al e Al explícitos do laudo (não deriva por cima)", () => {
    const v = { ca: 20, mg: 8, k: 391, ctc: 10, hAl: 2.5, al: 0.7, mPercent: 30 } as SoilValues;
    const s = analysisToSolo(v);
    expect(s.H_Al_cmolc_dm3).toBe(2.5); // usa o do laudo, não max(0, ctc-sb)
    expect(s.Al_cmolc_dm3).toBe(0.7);
  });

  it("sem dados suficientes, não inventa (nulls)", () => {
    const s = analysisToSolo(undefined);
    expect(s.Ca_cmolc_dm3).toBeNull();
    expect(s.H_Al_cmolc_dm3).toBeNull(); // sem SB nem ctc
    expect(s.Al_cmolc_dm3).toBeNull();
    // ca sem mg/k → SB null → sem derivação
    expect(analysisToSolo({ ca: 20, ctc: 5 } as SoilValues).H_Al_cmolc_dm3).toBeNull();
  });
});

describe("subFromValues", () => {
  it("null quando nada de 20-40 cm veio", () => {
    expect(subFromValues({} as SoilValues)).toBeNull();
    expect(subFromValues(undefined)).toBeNull();
  });
  it("monta a subsuperfície quando há ao menos um campo", () => {
    expect(subFromValues({ ca2040: 1.5 } as SoilValues)).toEqual({ Ca_cmolc_dm3: 1.5, Al_cmolc_dm3: null, m_percentual: null });
    expect(subFromValues({ al2040: 0.8, m2040: 25 } as SoilValues)).toEqual({ Ca_cmolc_dm3: null, Al_cmolc_dm3: 0.8, m_percentual: 25 });
  });
});
