import { describe, expect, it } from "vitest";
import { buildWeatherAlerts } from "./weatherAlerts";
import type { DailyForecast, SprayHour } from "./weather";

function day(partial: Partial<DailyForecast>): DailyForecast {
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
    ...partial,
  };
}

// Um horizonte "neutro" com chuva, sem geada/calor, para isolar cada alerta.
const NEUTRO: DailyForecast[] = [
  day({ tempMin: 14, precipitation: 2 }),
  day({ tempMin: 15, precipitation: 3 }),
];

describe("buildWeatherAlerts", () => {
  it("gera alerta ALTO de geada quando a mínima ≤ 3°C", () => {
    const alerts = buildWeatherAlerts([day({ tempMin: 2, weekdayLabel: "qua" })], []);
    const geada = alerts.find((a) => a.id === "clima-geada");
    expect(geada?.severity).toBe("alta");
    expect(geada?.title).toContain("2°C");
  });

  it("gera atenção (media) de geada entre 3°C e 5°C", () => {
    const alerts = buildWeatherAlerts([day({ tempMin: 5 })], []);
    expect(alerts.find((a) => a.id === "clima-geada-atencao")?.severity).toBe("media");
    expect(alerts.some((a) => a.id === "clima-geada")).toBe(false);
  });

  it("avisa chuva forte a partir de 30 mm", () => {
    const alerts = buildWeatherAlerts([day({ precipitation: 32 })], []);
    expect(alerts.find((a) => a.id === "clima-chuva-forte")?.title).toContain("32 mm");
  });

  it("avisa veranico quando não há chuva em ≥5 dias", () => {
    const seco = Array.from({ length: 6 }, () => day({ precipitation: 0 }));
    expect(buildWeatherAlerts(seco, []).some((a) => a.id === "clima-veranico")).toBe(true);
    // Com chuva em algum dia, não avisa.
    expect(buildWeatherAlerts(NEUTRO, []).some((a) => a.id === "clima-veranico")).toBe(false);
  });

  it("avisa calor extremo a partir de 34°C", () => {
    const alerts = buildWeatherAlerts([day({ tempMax: 35, precipitation: 2 })], []);
    expect(alerts.find((a) => a.id === "clima-calor")?.title).toContain("35°C");
  });

  it("aponta janela de pulverização ideal", () => {
    const windows: SprayHour[] = [
      {
        time: "2026-08-24T09:00",
        dayLabel: "seg 24/08",
        hourLabel: "09h",
        temp: 22,
        humidity: 70,
        precipitationProbability: 5,
        wind: 5,
        rating: "ideal",
        reason: "Condições favoráveis",
      },
    ];
    expect(buildWeatherAlerts(NEUTRO, windows).some((a) => a.id === "clima-janela-pulverizacao")).toBe(true);
  });

  it("sem previsão, não gera nada", () => {
    expect(buildWeatherAlerts([], [])).toEqual([]);
  });
});
