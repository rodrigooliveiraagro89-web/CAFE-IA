import { useCallback, useEffect, useState } from "react";
import type { AgriculturalController } from "../../lib/useAgriculturalContext";
import {
  buildSprayWindows,
  mapDailyForecast,
  plotCentroid,
  weatherCodeInfo,
  type DailyForecast,
  type LatLon,
  type OpenMeteoResponse,
  type SprayHour,
} from "../../domain/weather";

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
  sprayWindows: SprayHour[];
};

const INITIAL: WeatherState = {
  status: "idle",
  message: "",
  locationLabel: "",
  source: null,
  current: null,
  forecast: [],
  sprayWindows: [],
};

async function geocodeCity(city: string, state: string): Promise<LatLon | null> {
  if (!city) return null;
  const url = new URL(GEOCODE_API);
  url.searchParams.set("name", city);
  url.searchParams.set("count", "5");
  url.searchParams.set("language", "pt");
  url.searchParams.set("country", "BR");
  const response = await fetch(url.toString());
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
  url.searchParams.set(
    "current",
    "temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code",
  );
  url.searchParams.set(
    "daily",
    "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max",
  );
  url.searchParams.set(
    "hourly",
    "temperature_2m,relative_humidity_2m,precipitation_probability,wind_speed_10m,weather_code",
  );
  const response = await fetch(url.toString());
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
    forecast: mapDailyForecast(raw.daily),
    sprayWindows: buildSprayWindows(raw.hourly, new Date().toISOString()),
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
