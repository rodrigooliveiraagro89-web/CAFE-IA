import { describe, expect, it } from "vitest";
import { computeWaterBalance, type BalanceDay } from "./weatherBalance";

function serie(): BalanceDay[] {
  // 3 dias passados + hoje + 2 futuros.
  return [
    { date: "2026-08-21", precipitation: 10, et0: 4 },
    { date: "2026-08-22", precipitation: 0, et0: 5 },
    { date: "2026-08-23", precipitation: 5, et0: 3 },
    { date: "2026-08-24", precipitation: 2, et0: 4 }, // hoje
    { date: "2026-08-25", precipitation: 8, et0: 4 },
    { date: "2026-08-26", precipitation: 20, et0: 3 },
  ];
}

describe("computeWaterBalance", () => {
  const r = computeWaterBalance(serie(), "2026-08-24");

  it("acumula chuva observada (passado) e ET0 na janela", () => {
    const w7 = r.observado.find((o) => o.dias === 7)!;
    expect(w7.chuva).toBe(15); // 10 + 0 + 5
    expect(w7.et0).toBe(12); // 4 + 5 + 3
    expect(w7.balanco).toBe(3); // 15 - 12
  });

  it("acumula chuva prevista (hoje em diante)", () => {
    const p3 = r.previsto.find((p) => p.dias === 3)!;
    expect(p3.chuva).toBe(30); // 2 + 8 + 20
  });

  it("sem ET0 na janela → balanço nulo (não inventa)", () => {
    const semEt0: BalanceDay[] = [
      { date: "2026-08-22", precipitation: 5, et0: null },
      { date: "2026-08-23", precipitation: 3, et0: null },
    ];
    const w = computeWaterBalance(semEt0, "2026-08-24").observado.find((o) => o.dias === 7)!;
    expect(w.chuva).toBe(8);
    expect(w.et0).toBeNull();
    expect(w.balanco).toBeNull();
  });
});
