import { describe, expect, it } from "vitest";
import {
  DIARY_MAX_DAYS,
  mergeDays,
  rainByMonth,
  shiftDate,
  summarizeClimate,
  type DiaryDay,
} from "./climateDiary";

const day = (date: string, precip: number, tmin = 15, tmax = 28): DiaryDay => ({ date, tmin, tmax, precip });

describe("shiftDate", () => {
  it("desloca em dias (UTC)", () => {
    expect(shiftDate("2026-08-10", -1)).toBe("2026-08-09");
    expect(shiftDate("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftDate("2026-08-10", 5)).toBe("2026-08-15");
  });
});

describe("mergeDays", () => {
  it("faz upsert por data (novo vence), ordena e limita ao máximo", () => {
    const base = [day("2026-08-01", 5), day("2026-08-02", 0)];
    const novo = [day("2026-08-02", 12), day("2026-08-03", 3)]; // 08-02 atualiza
    const out = mergeDays(base, novo);
    expect(out.map((d) => d.date)).toEqual(["2026-08-01", "2026-08-02", "2026-08-03"]);
    expect(out.find((d) => d.date === "2026-08-02")!.precip).toBe(12);
  });

  it("mantém só os DIARY_MAX_DAYS mais recentes", () => {
    const muitos = Array.from({ length: DIARY_MAX_DAYS + 30 }, (_, i) => day(shiftDate("2020-01-01", i), 1));
    const out = mergeDays(muitos, []);
    expect(out).toHaveLength(DIARY_MAX_DAYS);
    expect(out[out.length - 1].date).toBe(shiftDate("2020-01-01", DIARY_MAX_DAYS + 29));
  });
});

describe("summarizeClimate", () => {
  const today = "2026-08-30";

  it("diário vazio não quebra", () => {
    const s = summarizeClimate([], today);
    expect(s.days).toBe(0);
    expect(s.rainTotal).toBe(0);
    expect(s.dryStreak).toBe(0);
    expect(s.from).toBeNull();
  });

  it("janelas de chuva, veranico, geadas, calor e GDD", () => {
    const days = [
      day("2026-08-25", 10), // dentro de 7d
      day("2026-08-26", 0),
      day("2026-08-27", 0),
      day("2026-08-28", 0),
      day("2026-08-29", 0), // últimos 4 dias secos → dryStreak 4
      day("2026-07-01", 20, 2, 33), // dentro de 90d (>= 06-02); geada (tmin 2)
      day("2026-06-01", 5, 10, 36), // 91º dia → FORA de 90d; calor (tmax 36)
    ];
    const s = summarizeClimate(days, today);
    expect(s.rain7).toBe(10); // só 08-25..08-29 (>= 08-24)
    expect(s.rain30).toBe(10); // 30d: >= 08-01, só as de agosto
    expect(s.rain90).toBe(30); // 90d: >= 06-02 → agosto (10) + 07-01 (20); 06-01 fica de fora
    expect(s.rainTotal).toBe(35); // todos os dias: 10 + 20 + 5
    expect(s.dryStreak).toBe(4);
    expect(s.frostCount).toBe(1);
    expect(s.heatCount).toBe(1);
    expect(s.gddTotal).toBeGreaterThan(0);
    expect(s.from).toBe("2026-06-01");
    expect(s.to).toBe("2026-08-29");
    expect(s.days).toBe(7);
  });

  it("dryStreak para no primeiro dia com chuva", () => {
    const s = summarizeClimate([day("2026-08-27", 8), day("2026-08-28", 0), day("2026-08-29", 0)], today);
    expect(s.dryStreak).toBe(2);
  });
});

describe("rainByMonth", () => {
  it("soma chuva por mês, ordenado", () => {
    const out = rainByMonth([day("2026-07-10", 10), day("2026-07-20", 5), day("2026-08-01", 3)]);
    expect(out).toEqual([
      { ym: "2026-07", mm: 15 },
      { ym: "2026-08", mm: 3 },
    ]);
  });
});
