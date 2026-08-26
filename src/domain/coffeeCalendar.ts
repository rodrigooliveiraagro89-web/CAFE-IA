import type { DailyForecast } from "./weather";
import type { WeatherGuidance } from "./weatherGuidance";
import { CALENDAR, monthName } from "./alertRules";

/**
 * Calendário do cafeicultor — as atividades por mês (referência para o Sul de
 * Minas, café arábica de montanha). Baseado no calendário clássico entregue ao
 * produtor. Serve para o app AVISAR o que fazer no mês SEM precisar agendar, e
 * cruzar com a previsão para gerar alertas oportunos. As datas variam por
 * região/altitude/cultivar — é orientação, não prescrição.
 *
 * Os meses vêm de ./alertRules (fonte única compartilhada com o push); aqui só
 * acrescentamos o `kind` (usado pelo cruzamento com o clima). Assim o calendário
 * do app e o resumo mensal por push nunca divergem.
 */

export type CalendarKind = Extract<
  WeatherGuidance["kind"],
  "analise" | "calagem" | "poda" | "manejo" | "adubacao" | "foliar" | "plantio" | "desbrota" | "colheita"
>;

export type CalendarActivity = {
  id: string;
  label: string;
  kind: CalendarKind;
  months: number[]; // 1 = janeiro … 12 = dezembro
};

const KIND_BY_ID: Record<string, CalendarKind> = {
  "analise-solo": "analise",
  "analise-foliar": "foliar",
  calagem: "calagem",
  podas: "poda",
  "manejo-mato": "manejo",
  "adubacao-solo": "adubacao",
  "adubacao-foliar": "foliar",
  plantio: "plantio",
  desbrotas: "desbrota",
  colheita: "colheita",
};

export const COFFEE_CALENDAR: CalendarActivity[] = CALENDAR.map((entry) => ({
  id: entry.id,
  label: entry.label,
  kind: KIND_BY_ID[entry.id] ?? "manejo",
  months: entry.months,
}));

export function monthLabel(month: number): string {
  return monthName(month);
}

/** Atividades recomendadas para o mês (1–12). */
export function activitiesForMonth(month: number): CalendarActivity[] {
  return COFFEE_CALENDAR.filter((a) => a.months.includes(month));
}

// Limiares para cruzar com o clima (coerentes com weatherGuidance).
const HEAVY_RAIN_MM = 30;
const LIGHT_RAIN_MIN_MM = 4;
const DRY_MM = 2;
const HARVEST_DRY_STREAK = 3;

function dm(day: DailyForecast): string {
  return `${day.weekdayLabel} (${day.date.slice(8, 10)}/${day.date.slice(5, 7)})`;
}

/**
 * Cruza o calendário do mês com a previsão para gerar avisos oportunos:
 * adubação (segurar antes da chuva forte / aproveitar chuva leve) e colheita
 * (dias secos bons / chuva chegando). O restante das atividades do mês aparece
 * no painel do calendário (chips), sem virar alerta de clima.
 */
export function calendarWeatherGuidance(
  month: number,
  forecast: DailyForecast[],
): WeatherGuidance[] {
  const items: WeatherGuidance[] = [];
  const ids = new Set(activitiesForMonth(month).map((a) => a.id));
  const h = forecast.slice(0, 7);
  if (h.length === 0) return items;

  const isAdub = ids.has("adubacao-solo") || ids.has("adubacao-foliar");
  if (isAdub) {
    const heavy = h.find((d) => d.precipitation >= HEAVY_RAIN_MM);
    const light = h.find((d) => d.precipitation >= LIGHT_RAIN_MIN_MM && d.precipitation < HEAVY_RAIN_MM);
    if (heavy) {
      items.push({
        id: "cal-adubacao",
        tone: "atencao",
        kind: "adubacao",
        title: "Época de adubação — segure antes da chuva forte",
        detail: `O calendário indica adubação neste mês, mas há ${heavy.precipitation} mm previstos para ${dm(heavy)}. Adube depois da chuva forte para evitar lixiviação.`,
      });
    } else if (light) {
      items.push({
        id: "cal-adubacao",
        tone: "bom",
        kind: "adubacao",
        title: "Época de adubação — chuva leve chegando",
        detail: `O calendário indica adubação e há chuva leve prevista (${light.precipitation} mm em ${dm(light)}), boa para incorporar o adubo.`,
      });
    } else {
      items.push({
        id: "cal-adubacao",
        tone: "info",
        kind: "adubacao",
        title: "Época de adubação",
        detail:
          "O calendário do cafeicultor indica adubação neste mês. Acompanhe a previsão e adube numa boa janela — uma chuva leve depois ajuda a incorporar.",
      });
    }
  }

  if (ids.has("colheita")) {
    let dry = 0;
    for (const d of h) {
      if (d.precipitation < DRY_MM) dry += 1;
      else break;
    }
    if (dry >= HARVEST_DRY_STREAK) {
      items.push({
        id: "cal-colheita",
        tone: "bom",
        kind: "colheita",
        title: "Época de colheita — dias secos pela frente",
        detail: `${dry} dias secos previstos: boa sequência para colher e secar no terreiro/secador.`,
      });
    } else {
      const rain = h.slice(0, 3).find((d) => d.precipitation >= 10);
      items.push(
        rain
          ? {
              id: "cal-colheita",
              tone: "atencao",
              kind: "colheita",
              title: "Época de colheita — chuva chegando",
              detail: `O calendário indica colheita; com chuva prevista para ${dm(rain)}, programe a colheita e proteja/recolha o café no terreiro.`,
            }
          : {
              id: "cal-colheita",
              tone: "info",
              kind: "colheita",
              title: "Época de colheita",
              detail: "O calendário do cafeicultor indica colheita neste mês.",
            },
      );
    }
  }

  return items;
}
