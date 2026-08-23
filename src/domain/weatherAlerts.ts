import type { Alert } from "./alerts";
import type { DailyForecast, SprayHour } from "./weather";

/**
 * Alertas de CLIMA — a partir da previsão real (Open-Meteo) já buscada pelo
 * módulo de clima, geramos os avisos que o cafeicultor de montanha precisa:
 * geada, chuva forte, veranico (déficit hídrico), calor extremo e a boa janela
 * de pulverização. Limiares nomeados e auditáveis, coerentes com a governança
 * do AGRYN — nada de número inventado, só o que está na previsão.
 */

export const WEATHER_ALERT_THRESHOLDS = {
  frostSevereMinC: 3, // mínima ≤ 3 °C: risco alto de geada no cafeeiro
  frostWatchMinC: 5, // mínima ≤ 5 °C: atenção (geada de radiação junto ao solo)
  heavyRainMm: 30, // ≥ 30 mm/dia: chuva forte (logística, lixiviação, erosão)
  heatMaxC: 34, // ≥ 34 °C: calor extremo (estresse na florada/granação)
  dryRainMm: 1, // dia "seco" se precipitação < 1 mm
  dryMinDays: 5, // janela mínima de dias sem chuva para avisar veranico
} as const;

const SEVERITY_ORDER = { alta: 0, media: 1, info: 2 } as const;

export function buildWeatherAlerts(
  forecast: DailyForecast[],
  sprayWindows: SprayHour[],
  locationLabel: string = "sua região",
): Alert[] {
  const alerts: Alert[] = [];
  if (!forecast.length) return alerts;
  const horizon = forecast.slice(0, 7);
  const t = WEATHER_ALERT_THRESHOLDS;

  // 1) Geada — o alerta mais crítico para café de montanha.
  const frostSevere = horizon.find((day) => day.tempMin <= t.frostSevereMinC);
  const frostWatch = horizon.find(
    (day) => day.tempMin <= t.frostWatchMinC && day.tempMin > t.frostSevereMinC,
  );
  if (frostSevere) {
    alerts.push({
      id: "clima-geada",
      severity: "alta",
      title: `Risco de geada (${frostSevere.tempMin}°C)`,
      detail: `Mínima de ${frostSevere.tempMin}°C prevista para ${frostSevere.weekdayLabel} em ${locationLabel}. Avalie proteção contra geada e evite tratos que exponham a lavoura.`,
      actionLabel: "Ver clima",
      actionView: "clima",
    });
  } else if (frostWatch) {
    alerts.push({
      id: "clima-geada-atencao",
      severity: "media",
      title: `Atenção a geada (${frostWatch.tempMin}°C)`,
      detail: `Mínima de ${frostWatch.tempMin}°C prevista para ${frostWatch.weekdayLabel}. Acompanhe a previsão nos próximos dias.`,
      actionLabel: "Ver clima",
      actionView: "clima",
    });
  }

  // 2) Chuva forte.
  const heavyRain = horizon.find((day) => day.precipitation >= t.heavyRainMm);
  if (heavyRain) {
    alerts.push({
      id: "clima-chuva-forte",
      severity: "media",
      title: `Chuva forte prevista (${heavyRain.precipitation} mm)`,
      detail: `${heavyRain.precipitation} mm previstos para ${heavyRain.weekdayLabel}. Planeje colheita, adubação (lixiviação) e drenagem.`,
      actionLabel: "Ver clima",
      actionView: "clima",
    });
  }

  // 3) Veranico / déficit hídrico — nenhuma chuva relevante na janela toda.
  const anyRain = horizon.some((day) => day.precipitation >= t.dryRainMm);
  if (!anyRain && horizon.length >= t.dryMinDays) {
    alerts.push({
      id: "clima-veranico",
      severity: "info",
      title: "Sem chuva nos próximos dias",
      detail: `Nenhuma chuva relevante prevista para os próximos ${horizon.length} dias em ${locationLabel}. Atenção ao déficit hídrico e ao manejo de irrigação.`,
      actionLabel: "Ver clima",
      actionView: "clima",
    });
  }

  // 4) Calor extremo.
  const heat = horizon.find((day) => day.tempMax >= t.heatMaxC);
  if (heat) {
    alerts.push({
      id: "clima-calor",
      severity: "media",
      title: `Calor extremo previsto (${heat.tempMax}°C)`,
      detail: `Máxima de ${heat.tempMax}°C para ${heat.weekdayLabel}. Estresse térmico na florada/granação; evite pulverizar nas horas mais quentes.`,
      actionLabel: "Ver clima",
      actionView: "clima",
    });
  }

  // 5) Boa janela de pulverização (oportunidade, não risco).
  const idealWindow = sprayWindows.find((window) => window.rating === "ideal");
  if (idealWindow) {
    alerts.push({
      id: "clima-janela-pulverizacao",
      severity: "info",
      title: "Boa janela de pulverização",
      detail: `${idealWindow.dayLabel}, ${idealWindow.hourLabel}: condições favoráveis (vento e chuva baixos). Aproveite para aplicações foliares.`,
      actionLabel: "Ver janelas",
      actionView: "clima",
    });
  }

  return alerts.sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );
}
