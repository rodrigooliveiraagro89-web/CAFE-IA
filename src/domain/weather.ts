import type { GeoPolygon } from "../features/ndvi/types";

/**
 * Lógica pura do módulo de clima — sem I/O, sem React. Recebe a resposta da
 * API pública Open-Meteo (sem chave) e a transforma no que o cafeicultor
 * precisa ler de bater o olho: previsão diária e, sobretudo, a JANELA DE
 * PULVERIZAÇÃO (quando o vento/umidade/chuva favorecem a aplicação). A
 * interpretação agronômica é determinística e auditável aqui, coerente com a
 * governança do AGRYN — a IA não emite parecer sobre clima.
 */

export type LatLon = { lat: number; lon: number };

// ---- Resposta bruta da Open-Meteo (subconjunto que pedimos) ----------------

export type OpenMeteoDaily = {
  time: string[];
  weather_code: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_sum: number[];
  precipitation_probability_max: number[];
  wind_speed_10m_max: number[];
  et0_fao_evapotranspiration?: number[];
};

export type OpenMeteoHourly = {
  time: string[];
  temperature_2m: number[];
  relative_humidity_2m: number[];
  precipitation_probability: number[];
  precipitation?: number[];
  wind_speed_10m: number[];
  weather_code: number[];
};

export type HourItem = {
  time: string;
  dayLabel: string;
  hourLabel: string;
  temp: number;
  humidity: number;
  precipitation: number;
  precipitationProbability: number;
  wind: number;
  code: number;
  icon: string;
};

/** Próximas N horas a partir de agora (padrão 72h), para a previsão horária. */
export function mapHourly(hourly: OpenMeteoHourly | undefined, nowISO: string, maxHours = 72): HourItem[] {
  if (!hourly?.time?.length) return [];
  const now = new Date(nowISO).getTime();
  const out: HourItem[] = [];
  for (let i = 0; i < hourly.time.length; i += 1) {
    const time = hourly.time[i];
    const parsed = new Date(time).getTime();
    if (Number.isNaN(parsed) || parsed < now) continue;
    const code = hourly.weather_code?.[i] ?? 0;
    const hour = time.slice(11, 13);
    out.push({
      time,
      dayLabel: `${weekdayLabel(time)} ${time.slice(8, 10)}/${time.slice(5, 7)}`,
      hourLabel: `${hour}h`,
      temp: Math.round(hourly.temperature_2m?.[i] ?? 0),
      humidity: Math.round(hourly.relative_humidity_2m?.[i] ?? 0),
      precipitation: Math.round((hourly.precipitation?.[i] ?? 0) * 10) / 10,
      precipitationProbability: Math.round(hourly.precipitation_probability?.[i] ?? 0),
      wind: Math.round(hourly.wind_speed_10m?.[i] ?? 0),
      code,
      icon: weatherCodeInfo(code).icon,
    });
    if (out.length >= maxHours) break;
  }
  return out;
}

export type OpenMeteoResponse = {
  latitude: number;
  longitude: number;
  timezone?: string;
  daily?: OpenMeteoDaily;
  hourly?: OpenMeteoHourly;
};

// ---- Saída normalizada -----------------------------------------------------

export type DailyForecast = {
  date: string;
  weekdayLabel: string;
  code: number;
  description: string;
  icon: string;
  tempMax: number;
  tempMin: number;
  precipitation: number;
  precipitationProbability: number;
  windMax: number;
};

export type SprayRating = "ideal" | "atencao" | "evitar";

export type SprayHour = {
  time: string;
  dayLabel: string;
  hourLabel: string;
  temp: number;
  humidity: number;
  precipitationProbability: number;
  wind: number;
  rating: SprayRating;
  reason: string;
};

// ---- Códigos de tempo WMO --------------------------------------------------

const WEATHER_CODES: Record<number, { description: string; icon: string }> = {
  0: { description: "Céu limpo", icon: "☀️" },
  1: { description: "Predomínio de sol", icon: "🌤️" },
  2: { description: "Parcialmente nublado", icon: "⛅" },
  3: { description: "Nublado", icon: "☁️" },
  45: { description: "Névoa", icon: "🌫️" },
  48: { description: "Névoa com geada", icon: "🌫️" },
  51: { description: "Garoa fraca", icon: "🌦️" },
  53: { description: "Garoa", icon: "🌦️" },
  55: { description: "Garoa forte", icon: "🌧️" },
  56: { description: "Garoa congelante", icon: "🌧️" },
  57: { description: "Garoa congelante forte", icon: "🌧️" },
  61: { description: "Chuva fraca", icon: "🌧️" },
  63: { description: "Chuva", icon: "🌧️" },
  65: { description: "Chuva forte", icon: "🌧️" },
  66: { description: "Chuva congelante", icon: "🌧️" },
  67: { description: "Chuva congelante forte", icon: "🌧️" },
  71: { description: "Neve fraca", icon: "❄️" },
  73: { description: "Neve", icon: "❄️" },
  75: { description: "Neve forte", icon: "❄️" },
  77: { description: "Grãos de neve", icon: "❄️" },
  80: { description: "Pancadas de chuva", icon: "🌧️" },
  81: { description: "Pancadas de chuva", icon: "🌧️" },
  82: { description: "Pancadas fortes", icon: "⛈️" },
  85: { description: "Pancadas de neve", icon: "🌨️" },
  86: { description: "Pancadas de neve fortes", icon: "🌨️" },
  95: { description: "Trovoada", icon: "⛈️" },
  96: { description: "Trovoada com granizo", icon: "⛈️" },
  99: { description: "Trovoada com granizo forte", icon: "⛈️" },
};

export function weatherCodeInfo(code: number): { description: string; icon: string } {
  return WEATHER_CODES[code] ?? { description: "Condição indefinida", icon: "🌡️" };
}

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;

// Rótulo de dia da semana a partir de "YYYY-MM-DD". Ancoramos ao meio-dia para
// que o fuso não empurre a data para o dia anterior.
export function weekdayLabel(isoDate: string): string {
  const parsed = new Date(`${isoDate.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return "";
  return WEEKDAYS[parsed.getDay()];
}

// ---- Centro do talhão (para localizar o clima sem geocodificar) ------------

export function plotCentroid(geometry: GeoPolygon | null): LatLon | null {
  if (!geometry) return null;
  const ring = geometry.coordinates?.[0];
  if (!Array.isArray(ring) || ring.length === 0) return null;
  // O anel costuma repetir o primeiro ponto no fim; ignoramos o fecho.
  const points = ring.length > 1 && ring[0]?.[0] === ring[ring.length - 1]?.[0] && ring[0]?.[1] === ring[ring.length - 1]?.[1]
    ? ring.slice(0, -1)
    : ring;
  if (points.length === 0) return null;
  let sumLon = 0;
  let sumLat = 0;
  for (const [lon, lat] of points) {
    sumLon += lon;
    sumLat += lat;
  }
  return { lat: sumLat / points.length, lon: sumLon / points.length };
}

// ---- Previsão diária -------------------------------------------------------

export function mapDailyForecast(daily: OpenMeteoDaily | undefined): DailyForecast[] {
  if (!daily?.time?.length) return [];
  return daily.time.map((date, index) => {
    const code = daily.weather_code[index] ?? 0;
    const info = weatherCodeInfo(code);
    return {
      date,
      weekdayLabel: weekdayLabel(date),
      code,
      description: info.description,
      icon: info.icon,
      tempMax: Math.round(daily.temperature_2m_max[index] ?? 0),
      tempMin: Math.round(daily.temperature_2m_min[index] ?? 0),
      precipitation: Math.round((daily.precipitation_sum[index] ?? 0) * 10) / 10,
      precipitationProbability: Math.round(daily.precipitation_probability_max[index] ?? 0),
      windMax: Math.round(daily.wind_speed_10m_max[index] ?? 0),
    };
  });
}

// ---- Janela de pulverização ------------------------------------------------

// Limites agronômicos para aplicação foliar no cafeeiro. Vento moderado evita
// deriva e má cobertura; chuva próxima lava o produto; calor/baixa umidade
// aceleram a evaporação da calda; umidade excessiva favorece escorrimento.
export const SPRAY_LIMITS = {
  windIdealMax: 10, // km/h
  windWarnMax: 15,
  windCalmMin: 2, // abaixo disso, risco de inversão térmica/deriva por evaporação
  rainProbIdealMax: 20, // %
  rainProbWarnMax: 50,
  tempIdealMin: 15, // °C
  tempIdealMax: 28,
  tempWarnMin: 10,
  tempWarnMax: 32,
  humidityIdealMin: 55, // %
  humidityIdealMax: 92,
  humidityWarnMin: 45,
  humidityWarnMax: 95,
} as const;

const SEVERITY: Record<SprayRating, number> = { ideal: 0, atencao: 1, evitar: 2 };

type Factor = { rating: SprayRating; reason: string };

function rateWind(wind: number): Factor {
  if (wind > SPRAY_LIMITS.windWarnMax) return { rating: "evitar", reason: "vento forte (deriva)" };
  if (wind > SPRAY_LIMITS.windIdealMax) return { rating: "atencao", reason: "vento moderado" };
  if (wind < SPRAY_LIMITS.windCalmMin) return { rating: "atencao", reason: "vento muito fraco (inversão térmica)" };
  return { rating: "ideal", reason: "" };
}

function rateRain(prob: number): Factor {
  if (prob > SPRAY_LIMITS.rainProbWarnMax) return { rating: "evitar", reason: "alta chance de chuva" };
  if (prob > SPRAY_LIMITS.rainProbIdealMax) return { rating: "atencao", reason: "risco de chuva" };
  return { rating: "ideal", reason: "" };
}

function rateTemp(temp: number): Factor {
  if (temp < SPRAY_LIMITS.tempWarnMin || temp > SPRAY_LIMITS.tempWarnMax) {
    return { rating: "evitar", reason: temp > SPRAY_LIMITS.tempWarnMax ? "calor excessivo" : "frio excessivo" };
  }
  if (temp < SPRAY_LIMITS.tempIdealMin || temp > SPRAY_LIMITS.tempIdealMax) {
    return { rating: "atencao", reason: temp > SPRAY_LIMITS.tempIdealMax ? "temperatura alta" : "temperatura baixa" };
  }
  return { rating: "ideal", reason: "" };
}

function rateHumidity(humidity: number): Factor {
  if (humidity < SPRAY_LIMITS.humidityWarnMin || humidity > SPRAY_LIMITS.humidityWarnMax) {
    return {
      rating: "evitar",
      reason: humidity < SPRAY_LIMITS.humidityWarnMin ? "ar muito seco (evaporação)" : "umidade muito alta (escorrimento)",
    };
  }
  if (humidity < SPRAY_LIMITS.humidityIdealMin || humidity > SPRAY_LIMITS.humidityIdealMax) {
    return {
      rating: "atencao",
      reason: humidity < SPRAY_LIMITS.humidityIdealMin ? "ar seco" : "umidade alta",
    };
  }
  return { rating: "ideal", reason: "" };
}

export function rateSprayConditions(input: {
  temp: number;
  humidity: number;
  precipitationProbability: number;
  wind: number;
}): { rating: SprayRating; reason: string } {
  const factors = [
    rateRain(input.precipitationProbability),
    rateWind(input.wind),
    rateHumidity(input.humidity),
    rateTemp(input.temp),
  ];
  let worst: SprayRating = "ideal";
  for (const factor of factors) {
    if (SEVERITY[factor.rating] > SEVERITY[worst]) worst = factor.rating;
  }
  if (worst === "ideal") return { rating: "ideal", reason: "Condições favoráveis à pulverização" };
  const reasons = factors
    .filter((factor) => factor.rating === worst && factor.reason)
    .map((factor) => factor.reason);
  return { rating: worst, reason: capitalize(reasons.join(", ")) };
}

function capitalize(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

// Horas úteis de campo consideradas para pulverização.
const DAY_START_HOUR = 6;
const DAY_END_HOUR = 18;

// Constrói a lista de horas diurnas futuras com a nota de pulverização.
// `nowISO` é injetado (nada de relógio interno) para manter a função pura.
export function buildSprayWindows(
  hourly: OpenMeteoHourly | undefined,
  nowISO: string,
  maxHours = 18,
): SprayHour[] {
  if (!hourly?.time?.length) return [];
  const now = new Date(nowISO);
  const windows: SprayHour[] = [];
  for (let index = 0; index < hourly.time.length; index += 1) {
    const time = hourly.time[index];
    const parsed = new Date(time);
    if (Number.isNaN(parsed.getTime()) || parsed.getTime() < now.getTime()) continue;
    const hour = parsed.getHours();
    if (hour < DAY_START_HOUR || hour > DAY_END_HOUR) continue;
    const temp = hourly.temperature_2m[index] ?? 0;
    const humidity = hourly.relative_humidity_2m[index] ?? 0;
    const precipitationProbability = hourly.precipitation_probability[index] ?? 0;
    const wind = hourly.wind_speed_10m[index] ?? 0;
    const { rating, reason } = rateSprayConditions({ temp, humidity, precipitationProbability, wind });
    windows.push({
      time,
      dayLabel: `${weekdayLabel(time)} ${time.slice(8, 10)}/${time.slice(5, 7)}`,
      hourLabel: `${String(hour).padStart(2, "0")}h`,
      temp: Math.round(temp),
      humidity: Math.round(humidity),
      precipitationProbability: Math.round(precipitationProbability),
      wind: Math.round(wind),
      rating,
      reason,
    });
    if (windows.length >= maxHours) break;
  }
  return windows;
}

export const SPRAY_RATING_LABEL: Record<SprayRating, string> = {
  ideal: "Ideal",
  atencao: "Atenção",
  evitar: "Evitar",
};
