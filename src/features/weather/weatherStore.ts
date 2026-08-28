import { useCallback, useEffect, useState } from "react";
import { fetchWithTimeout } from "../../lib/http";
import type { AgriculturalController } from "../../lib/useAgriculturalContext";
import {
  buildSprayWindows,
  mapDailyForecast,
  mapHourly,
  plotCentroid,
  weatherCodeInfo,
  type DailyForecast,
  type HourItem,
  type LatLon,
  type OpenMeteoResponse,
  type SprayHour,
} from "../../domain/weather";
import { computeWaterBalance, type WaterBalance } from "../../domain/weatherBalance";

const FORECAST_API = "https://api.open-meteo.com/v1/forecast";
const GEOCODE_API = "https://geocoding-api.open-meteo.com/v1/search";

export type WeatherSource = "talhao" | "cidade" | "gps";

export type CurrentConditions = {
  temp: number;
  humidity: number;
  wind: number;
  description: string;
  icon: string;
};

export type WeatherState = {
  status: "idle" | "loading" | "ready" | "error";
  message: string;
  locationLabel: string;
  source: WeatherSource | null;
  current: CurrentConditions | null;
  forecast: DailyForecast[];
  observed: DailyForecast[]; // dias passados (para o diário climático)
  hourly: HourItem[];
  sprayWindows: SprayHour[];
  balance: WaterBalance | null;
};

const INITIAL: WeatherState = {
  status: "idle",
  message: "",
  locationLabel: "",
  source: null,
  current: null,
  forecast: [],
  observed: [],
  hourly: [],
  sprayWindows: [],
  balance: null,
};

async function geocodeCity(city: string, state: string): Promise<LatLon | null> {
  if (!city) return null;
  const url = new URL(GEOCODE_API);
  url.searchParams.set("name", city);
  url.searchParams.set("count", "5");
  url.searchParams.set("language", "pt");
  url.searchParams.set("country", "BR");
  const response = await fetchWithTimeout(url.toString(), {}, 15_000);
  if (!response.ok) return null;
  const data = (await response.json()) as {
    results?: Array<{ latitude: number; longitude: number; admin1?: string }>;
  };
  const results = data.results ?? [];
  if (results.length === 0) return null;
  // Preferimos o resultado cujo estado bate com o cadastro da propriedade.
  const byState = state
    ? results.find((item) => (item.admin1 ?? "").toLowerCase().includes(state.toLowerCase()))
    : undefined;
  const chosen = byState ?? results[0];
  return { lat: chosen.latitude, lon: chosen.longitude };
}

async function fetchForecast(location: LatLon): Promise<OpenMeteoResponse> {
  const url = new URL(FORECAST_API);
  url.searchParams.set("latitude", String(location.lat));
  url.searchParams.set("longitude", String(location.lon));
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "7");
  url.searchParams.set("past_days", "31"); // chuva observada e balanço hídrico
  url.searchParams.set(
    "current",
    "temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code",
  );
  url.searchParams.set(
    "daily",
    "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,et0_fao_evapotranspiration",
  );
  url.searchParams.set(
    "hourly",
    "temperature_2m,relative_humidity_2m,precipitation,precipitation_probability,wind_speed_10m,weather_code",
  );
  const response = await fetchWithTimeout(url.toString(), {}, 15_000);
  if (!response.ok) throw new Error("Não foi possível obter a previsão do tempo agora.");
  return (await response.json()) as OpenMeteoResponse;
}

function toState(raw: OpenMeteoResponse, label: string, source: WeatherSource): WeatherState {
  const current = raw as OpenMeteoResponse & {
    current?: {
      temperature_2m?: number;
      relative_humidity_2m?: number;
      wind_speed_10m?: number;
      weather_code?: number;
    };
  };
  const info = weatherCodeInfo(current.current?.weather_code ?? 0);
  // "Hoje" no FUSO da série (timezone=auto traz utc_offset_seconds), não em UTC —
  // senão o dia local em curso entraria como "observado" no diário climático.
  const offsetSec = (raw as OpenMeteoResponse & { utc_offset_seconds?: number }).utc_offset_seconds ?? 0;
  const today = new Date(Date.now() + offsetSec * 1000).toISOString().slice(0, 10);
  // A série vem com dias passados (past_days): a previsão exibida é só de hoje
  // em diante; os dias passados alimentam a chuva acumulada e o balanço.
  const allDaily = mapDailyForecast(raw.daily);
  const forecast = allDaily.filter((d) => d.date.slice(0, 10) >= today).slice(0, 7);
  const observed = allDaily.filter((d) => d.date.slice(0, 10) < today);
  const daily = raw.daily;
  const balanceDays = (daily?.time ?? []).map((date, i) => ({
    date,
    precipitation: daily?.precipitation_sum?.[i] ?? 0,
    et0: daily?.et0_fao_evapotranspiration?.[i] ?? null,
  }));
  return {
    status: "ready",
    message: "",
    locationLabel: label,
    source,
    current: current.current
      ? {
          temp: Math.round(current.current.temperature_2m ?? 0),
          humidity: Math.round(current.current.relative_humidity_2m ?? 0),
          wind: Math.round(current.current.wind_speed_10m ?? 0),
          description: info.description,
          icon: info.icon,
        }
      : null,
    forecast,
    observed,
    hourly: mapHourly(raw.hourly, new Date().toISOString(), 72),
    sprayWindows: buildSprayWindows(raw.hourly, new Date().toISOString()),
    balance: balanceDays.length ? computeWaterBalance(balanceDays, today) : null,
  };
}

/**
 * Resolve a localização (centro do talhão → cidade cadastrada → GPS do
 * aparelho) e busca a previsão pública Open-Meteo. Nenhuma chave de API.
 */
export function useWeather(agriculture: AgriculturalController) {
  const [state, setState] = useState<WeatherState>(INITIAL);

  const property = agriculture.selectedProperty;
  const plot = agriculture.selectedPlot;
  const cityLabel = property ? [property.city, property.state].filter(Boolean).join(", ") : "";
  const centroid = plotCentroid(plot?.geometry ?? null);
  const centroidKey = centroid ? `${centroid.lat.toFixed(3)},${centroid.lon.toFixed(3)}` : "";

  const loadFromContext = useCallback(async () => {
    setState((prev) => ({ ...prev, status: "loading", message: "" }));
    try {
      if (centroid) {
        const raw = await fetchForecast(centroid);
        setState(toState(raw, plot ? `Talhão ${plot.name}` : "Talhão selecionado", "talhao"));
        return;
      }
      if (cityLabel) {
        const geo = await geocodeCity(property?.city ?? "", property?.state ?? "");
        if (geo) {
          const raw = await fetchForecast(geo);
          setState(toState(raw, cityLabel, "cidade"));
          return;
        }
      }
      setState({
        ...INITIAL,
        status: "error",
        message:
          "Cadastre a cidade da propriedade (ou desenhe um talhão) para localizar o clima — ou use sua localização atual.",
      });
    } catch (error) {
      setState({
        ...INITIAL,
        status: "error",
        message: error instanceof Error ? error.message : "Falha ao buscar o clima.",
      });
    }
    // centroidKey/cityLabel cobrem as dependências reais de localização.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centroidKey, cityLabel]);

  const useMyLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setState((prev) => ({ ...prev, status: "error", message: "Este aparelho não informa a localização." }));
      return;
    }
    setState((prev) => ({ ...prev, status: "loading", message: "" }));
    navigator.geolocation.getCurrentPosition(
      (position) => {
        fetchForecast({ lat: position.coords.latitude, lon: position.coords.longitude })
          .then((raw) => setState(toState(raw, "Sua localização atual", "gps")))
          .catch((error: unknown) =>
            setState({
              ...INITIAL,
              status: "error",
              message: error instanceof Error ? error.message : "Falha ao buscar o clima.",
            }),
          );
      },
      () =>
        setState((prev) => ({
          ...prev,
          status: "error",
          message: "Não conseguimos acessar sua localização. Verifique a permissão do navegador.",
        })),
      { enableHighAccuracy: false, timeout: 10000 },
    );
  }, []);

  useEffect(() => {
    // Defere para um microtask: mantém o setState de "loading" fora da fase
    // síncrona do efeito (regra react-hooks/set-state-in-effect), mesmo padrão
    // do fetch em .then usado nos demais módulos.
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return loadFromContext();
    });
    return () => {
      active = false;
    };
  }, [loadFromContext]);

  return { ...state, reload: loadFromContext, useMyLocation };
}
