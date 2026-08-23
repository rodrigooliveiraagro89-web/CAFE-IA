import type { DailyForecast, SprayHour } from "./weather";

/**
 * "O que fazer" — recomendações agronômicas concretas a partir da previsão real
 * (Open-Meteo), pensadas para o café arábica de montanha do Sul de Minas. Puro e
 * testável. NÃO é parecer técnico: são orientações de manejo baseadas no tempo,
 * com limiares nomeados e auditáveis; a decisão final é do responsável técnico.
 */

export type GuidanceTone = "critico" | "atencao" | "bom" | "info";

export type WeatherGuidance = {
  id: string;
  tone: GuidanceTone;
  /** categoria para escolher o ícone na tela */
  kind: "geada" | "chuva" | "seca" | "calor" | "pulverizacao" | "colheita" | "doenca" | "adubacao";
  title: string;
  detail: string;
};

export const GUIDANCE_THRESHOLDS = {
  frostSevereMinC: 3,
  frostWatchMinC: 5,
  heavyRainMm: 30,
  lightRainMinMm: 4, // chuva leve útil (incorpora adubo) entre este e o forte
  heatMaxC: 34,
  dryPrecipMm: 2, // dia considerado seco
  wetPrecipMm: 1, // dia considerado com chuva relevante
  drySpellDays: 5, // sem chuva na janela → veranico
  harvestDryStreak: 3, // dias secos seguidos → bom p/ colher e secar
  diseaseWetDays: 4, // dias de chuva na semana favoráveis a ferrugem/cercóspora
  diseaseTminC: 15,
  diseaseTmaxC: 28,
} as const;

const TONE_ORDER: Record<GuidanceTone, number> = { critico: 0, atencao: 1, bom: 2, info: 3 };

function dmLabel(day: DailyForecast): string {
  return `${day.weekdayLabel} (${day.date.slice(8, 10)}/${day.date.slice(5, 7)})`;
}

export function buildWeatherGuidance(
  forecast: DailyForecast[],
  sprayWindows: SprayHour[] = [],
): WeatherGuidance[] {
  const out: WeatherGuidance[] = [];
  if (!forecast.length) return out;
  const t = GUIDANCE_THRESHOLDS;
  const horizon = forecast.slice(0, 7);

  // 1) Geada.
  const frost = horizon.find((d) => d.tempMin <= t.frostWatchMinC);
  if (frost) {
    const severe = frost.tempMin <= t.frostSevereMinC;
    out.push({
      id: "geada",
      tone: severe ? "critico" : "atencao",
      kind: "geada",
      title: severe ? `Proteja contra geada — ${frost.tempMin}°C` : `Atenção a geada — ${frost.tempMin}°C`,
      detail: `Mínima de ${frost.tempMin}°C em ${dmLabel(frost)}. Em áreas de risco, avalie proteção (irrigação/quebra-vento) e evite tratos que exponham a lavoura na madrugada.`,
    });
  }

  // 2) Chuva forte chegando.
  const heavy = horizon.find((d) => d.precipitation >= t.heavyRainMm);
  if (heavy) {
    out.push({
      id: "chuva-forte",
      tone: "atencao",
      kind: "chuva",
      title: `Chuva forte em ${dmLabel(heavy)} — ${heavy.precipitation} mm`,
      detail:
        "Evite adubação nitrogenada em cobertura logo antes (risco de lixiviação). Reforce drenagem e programe a colheita/secagem para antes ou depois da chuva.",
    });
  }

  // 3) Adubação: chuva LEVE útil depois de dias secos (incorpora o adubo).
  const light = horizon.find(
    (d) => d.precipitation >= t.lightRainMinMm && d.precipitation < t.heavyRainMm,
  );
  if (light && !heavy) {
    out.push({
      id: "adubacao-chuva-leve",
      tone: "bom",
      kind: "adubacao",
      title: `Chuva leve em ${dmLabel(light)} — boa para adubar`,
      detail: `Previsão de ${light.precipitation} mm, suficiente para incorporar o adubo sem grande perda. Boa janela para adubação de cobertura se o solo permitir.`,
    });
  }

  // 4) Veranico / déficit hídrico.
  const wetDays = horizon.filter((d) => d.precipitation >= t.wetPrecipMm);
  if (wetDays.length === 0 && horizon.length >= t.drySpellDays) {
    out.push({
      id: "veranico",
      tone: "info",
      kind: "seca",
      title: "Sem chuva prevista para a semana",
      detail: `Nenhuma chuva relevante nos próximos ${horizon.length} dias. Programe irrigação onde houver e priorize água em talhões em florada/chumbinho (fase crítica).`,
    });
  }

  // 5) Colheita e secagem: sequência de dias secos a partir de hoje.
  let dryStreak = 0;
  for (const d of horizon) {
    if (d.precipitation < t.dryPrecipMm) dryStreak += 1;
    else break;
  }
  if (dryStreak >= t.harvestDryStreak) {
    out.push({
      id: "colheita",
      tone: "bom",
      kind: "colheita",
      title: `${dryStreak} dias secos pela frente`,
      detail:
        "Boa sequência para colher e secar no terreiro/secador. Aproveite para avançar a secagem antes da próxima chuva.",
    });
  } else {
    const rainSoon = horizon.slice(0, 3).find((d) => d.precipitation >= 10);
    if (rainSoon) {
      out.push({
        id: "recolher-cafe",
        tone: "atencao",
        kind: "colheita",
        title: `Chuva em ${dmLabel(rainSoon)} — proteja o café`,
        detail:
          "Recolha ou cubra o café no terreiro e evite deixar café colhido no campo, para não fermentar nem manchar a bebida.",
      });
    }
  }

  // 6) Calor extremo.
  const hot = horizon.find((d) => d.tempMax >= t.heatMaxC);
  if (hot) {
    out.push({
      id: "calor",
      tone: "atencao",
      kind: "calor",
      title: `Calor forte em ${dmLabel(hot)} — ${hot.tempMax}°C`,
      detail:
        "Evite pulverizar nas horas quentes (evaporação/deriva) — prefira o começo da manhã ou o fim da tarde. Atenção ao estresse térmico na florada e na granação.",
    });
  }

  // 7) Risco de doença (ferrugem/cercóspora): muitos dias úmidos e temperatura amena.
  const wetCount = wetDays.length;
  const mildDays = horizon.filter(
    (d) => d.tempMin >= t.diseaseTminC && d.tempMax <= t.diseaseTmaxC,
  ).length;
  if (wetCount >= t.diseaseWetDays && mildDays >= 3) {
    out.push({
      id: "doenca",
      tone: "atencao",
      kind: "doenca",
      title: "Tempo favorável a ferrugem/cercóspora",
      detail:
        "Semana úmida e amena favorece fungos. Monitore as folhas e planeje fungicida preventivo numa boa janela de pulverização (sem chuva e vento baixo).",
    });
  }

  // 8) Pulverização: aponte a melhor janela próxima (oportunidade).
  const ideal = sprayWindows.find((w) => w.rating === "ideal");
  if (ideal) {
    out.push({
      id: "pulverizacao-boa",
      tone: "bom",
      kind: "pulverizacao",
      title: `Boa janela de pulverização — ${ideal.dayLabel} ${ideal.hourLabel}`,
      detail: "Vento e chuva baixos. Boa hora para aplicações foliares planejadas.",
    });
  } else if (sprayWindows.length > 0 && sprayWindows.every((w) => w.rating === "evitar")) {
    out.push({
      id: "pulverizacao-evitar",
      tone: "atencao",
      kind: "pulverizacao",
      title: "Evite pulverizar nas próximas horas",
      detail:
        "As condições previstas (vento, chuva ou temperatura) estão desfavoráveis à aplicação. Aguarde uma janela melhor.",
    });
  }

  return out.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
}
