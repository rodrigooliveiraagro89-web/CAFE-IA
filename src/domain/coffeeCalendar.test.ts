import { describe, expect, it } from "vitest";
import { activitiesForMonth, calendarWeatherGuidance, monthLabel } from "./coffeeCalendar";
import type { DailyForecast } from "./weather";

function day(p: Partial<DailyForecast>): DailyForecast {
  return {
    date: "2026-08-24",
    weekdayLabel: "seg",
    code: 0,
    description: "",
    icon: "",
    tempMax: 26,
    tempMin: 14,
    precipitation: 0,
    precipitationProbability: 0,
    windMax: 6,
    ...p,
  };
}

describe("coffeeCalendar", () => {
  it("agosto inclui colheita, podas e calagem", () => {
    const ids = activitiesForMonth(8).map((a) => a.id);
    expect(ids).toContain("colheita");
    expect(ids).toContain("podas");
    expect(ids).toContain("calagem");
    expect(ids).not.toContain("adubacao-solo"); // ago não tem adubação via solo
  });

  it("novembro inclui adubação via solo e foliar", () => {
    const ids = activitiesForMonth(11).map((a) => a.id);
    expect(ids).toContain("adubacao-solo");
    expect(ids).toContain("adubacao-foliar");
  });

  it("monthLabel devolve o nome do mês", () => {
    expect(monthLabel(11)).toBe("novembro");
  });

  it("adubação + chuva forte → segurar (atenção)", () => {
    const g = calendarWeatherGuidance(11, [day({ precipitation: 40, weekdayLabel: "ter" })]);
    const item = g.find((x) => x.id === "cal-adubacao");
    expect(item?.tone).toBe("atencao");
  });

  it("adubação + chuva leve → boa janela (bom)", () => {
    const g = calendarWeatherGuidance(11, [day({ precipitation: 8 })]);
    expect(g.find((x) => x.id === "cal-adubacao")?.tone).toBe("bom");
  });

  it("colheita + dias secos → bom", () => {
    const seco = Array.from({ length: 4 }, () => day({ precipitation: 0 }));
    expect(calendarWeatherGuidance(8, seco).find((x) => x.id === "cal-colheita")?.tone).toBe("bom");
  });

  it("mês sem adubação/colheita e sem previsão → vazio", () => {
    expect(calendarWeatherGuidance(6, [])).toEqual([]);
  });
});
