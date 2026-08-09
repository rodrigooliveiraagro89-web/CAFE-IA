import { describe, expect, it } from "vitest";
import {
  buildSprayWindows,
  mapDailyForecast,
  plotCentroid,
  rateSprayConditions,
  weatherCodeInfo,
  weekdayLabel,
  type OpenMeteoDaily,
  type OpenMeteoHourly,
} from "./weather";

describe("weatherCodeInfo", () => {
  it("mapeia códigos WMO conhecidos", () => {
    expect(weatherCodeInfo(0).description).toBe("Céu limpo");
    expect(weatherCodeInfo(95).description).toBe("Trovoada");
  });

  it("cai em condição indefinida para código desconhecido", () => {
    expect(weatherCodeInfo(1234).description).toBe("Condição indefinida");
  });
});

describe("weekdayLabel", () => {
  it("não desloca a data pelo fuso (âncora ao meio-dia)", () => {
    // 2026-08-10 é uma segunda-feira.
    expect(weekdayLabel("2026-08-10")).toBe("seg");
    expect(weekdayLabel("2026-08-10T00:00")).toBe("seg");
  });
});

describe("plotCentroid", () => {
  it("calcula o centro do polígono ignorando o ponto de fecho", () => {
    const centroid = plotCentroid({
      type: "Polygon",
      coordinates: [
        [
          [-46, -21],
          [-44, -21],
          [-44, -19],
          [-46, -19],
          [-46, -21],
        ],
      ],
    });
    expect(centroid).not.toBeNull();
    expect(centroid?.lon).toBeCloseTo(-45, 5);
    expect(centroid?.lat).toBeCloseTo(-20, 5);
  });

  it("retorna null sem geometria", () => {
    expect(plotCentroid(null)).toBeNull();
  });
});

describe("rateSprayConditions", () => {
  it("classifica como ideal quando tudo está na faixa", () => {
    const result = rateSprayConditions({ temp: 22, humidity: 70, precipitationProbability: 5, wind: 6 });
    expect(result.rating).toBe("ideal");
  });

  it("evita com alta chance de chuva mesmo com o resto bom", () => {
    const result = rateSprayConditions({ temp: 22, humidity: 70, precipitationProbability: 80, wind: 6 });
    expect(result.rating).toBe("evitar");
    expect(result.reason.toLowerCase()).toContain("chuva");
  });

  it("marca atenção com vento moderado", () => {
    const result = rateSprayConditions({ temp: 22, humidity: 70, precipitationProbability: 5, wind: 12 });
    expect(result.rating).toBe("atencao");
    expect(result.reason.toLowerCase()).toContain("vento");
  });

  it("evita com calor excessivo", () => {
    const result = rateSprayConditions({ temp: 35, humidity: 70, precipitationProbability: 5, wind: 6 });
    expect(result.rating).toBe("evitar");
  });
});

describe("mapDailyForecast", () => {
  const daily: OpenMeteoDaily = {
    time: ["2026-08-10", "2026-08-11"],
    weather_code: [0, 61],
    temperature_2m_max: [27.4, 24.1],
    temperature_2m_min: [14.6, 13.2],
    precipitation_sum: [0, 8.3],
    precipitation_probability_max: [10, 70],
    wind_speed_10m_max: [12, 18],
  };

  it("normaliza e arredonda os dias", () => {
    const forecast = mapDailyForecast(daily);
    expect(forecast).toHaveLength(2);
    expect(forecast[0]).toMatchObject({ tempMax: 27, tempMin: 15, description: "Céu limpo", weekdayLabel: "seg" });
    expect(forecast[1].precipitationProbability).toBe(70);
  });

  it("retorna vazio sem dados", () => {
    expect(mapDailyForecast(undefined)).toEqual([]);
  });
});

describe("buildSprayWindows", () => {
  const hourly: OpenMeteoHourly = {
    time: ["2026-08-10T05:00", "2026-08-10T08:00", "2026-08-10T14:00", "2026-08-10T20:00"],
    temperature_2m: [12, 20, 30, 18],
    relative_humidity_2m: [90, 70, 40, 80],
    precipitation_probability: [0, 5, 10, 0],
    wind_speed_10m: [3, 5, 8, 4],
    weather_code: [2, 1, 0, 2],
  };

  it("filtra horas passadas e noturnas, mantendo só horário de campo", () => {
    const windows = buildSprayWindows(hourly, "2026-08-10T07:00");
    // 05h é noturno/passado; 20h é fora do horário; sobram 08h e 14h.
    expect(windows.map((window) => window.hourLabel)).toEqual(["08h", "14h"]);
  });

  it("classifica a hora de calor+ar seco como evitar", () => {
    const windows = buildSprayWindows(hourly, "2026-08-10T07:00");
    const twoPm = windows.find((window) => window.hourLabel === "14h");
    expect(twoPm?.rating).toBe("evitar");
    const eightAm = windows.find((window) => window.hourLabel === "08h");
    expect(eightAm?.rating).toBe("ideal");
  });
});
