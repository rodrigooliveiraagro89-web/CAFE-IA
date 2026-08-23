import { describe, expect, it } from "vitest";
import { buildWeatherGuidance } from "./weatherGuidance";
import type { DailyForecast } from "./weather";

function day(p: Partial<DailyForecast>): DailyForecast {
  return {
    date: "2026-08-24",
    weekdayLabel: "seg",
    code: 0,
    description: "Céu limpo",
    icon: "☀️",
    tempMax: 26,
    tempMin: 14,
    precipitation: 0,
    precipitationProbability: 0,
    windMax: 6,
    ...p,
  };
}

const has = (list: ReturnType<typeof buildWeatherGuidance>, id: string) =>
  list.some((g) => g.id === id);

describe("buildWeatherGuidance", () => {
  it("recomenda proteção de geada (crítico) com mínima ≤3°C", () => {
    const g = buildWeatherGuidance([day({ tempMin: 2 })]);
    const item = g.find((x) => x.id === "geada");
    expect(item?.tone).toBe("critico");
  });

  it("alerta chuva forte e desaconselha adubar antes", () => {
    const g = buildWeatherGuidance([day({ precipitation: 35, weekdayLabel: "ter" })]);
    expect(has(g, "chuva-forte")).toBe(true);
    expect(has(g, "adubacao-chuva-leve")).toBe(false);
  });

  it("indica chuva leve como boa janela de adubação", () => {
    const g = buildWeatherGuidance([day({ precipitation: 8 })]);
    expect(g.find((x) => x.id === "adubacao-chuva-leve")?.tone).toBe("bom");
  });

  it("aponta dias secos como bons para colher e secar", () => {
    const seco = Array.from({ length: 4 }, () => day({ precipitation: 0 }));
    expect(has(buildWeatherGuidance(seco), "colheita")).toBe(true);
  });

  it("manda recolher o café quando chove logo após dias não-secos", () => {
    const g = buildWeatherGuidance([day({ precipitation: 3 }), day({ precipitation: 15, weekdayLabel: "ter" })]);
    expect(has(g, "recolher-cafe")).toBe(true);
  });

  it("avisa veranico quando não há chuva na semana", () => {
    const seco = Array.from({ length: 6 }, () => day({ precipitation: 0 }));
    expect(has(buildWeatherGuidance(seco), "veranico")).toBe(true);
  });

  it("sinaliza risco de doença em semana úmida e amena", () => {
    const umido = Array.from({ length: 7 }, () => day({ precipitation: 4, tempMin: 16, tempMax: 25 }));
    expect(has(buildWeatherGuidance(umido), "doenca")).toBe(true);
  });

  it("ordena por gravidade (crítico primeiro)", () => {
    const g = buildWeatherGuidance([day({ tempMin: 2, precipitation: 8 })]);
    expect(g[0].tone).toBe("critico");
  });

  it("sem previsão, retorna vazio", () => {
    expect(buildWeatherGuidance([])).toEqual([]);
  });
});
