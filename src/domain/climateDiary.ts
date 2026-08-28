/**
 * climateDiary — a MEMÓRIA climática do talhão (§9 "AgrynMemory").
 *
 * O clima do app vem da Open-Meteo (previsão + ~31 dias passados), mas é
 * EFÊMERO: fora da janela da API o histórico se perde. Aqui persistimos os dias
 * OBSERVADOS por talhão, acumulando um registro permanente que vira memória:
 * chuva acumulada, veranico (dias secos seguidos), geadas e calor registrados,
 * graus-dia do café. Módulo PURO (só tipos) — o store captura, isto agrega.
 */

export type DiaryDay = { date: string; tmin: number; tmax: number; precip: number };
export type ClimateDiary = { plotId: string; days: DiaryDay[]; updatedAt: string };

export const DIARY_MAX_DAYS = 400; // ~13 meses: limita o tamanho do jsonb por talhão

// Limiares (coerentes com push-alerts/alertRules quando aplicável).
export const GEADA_C = 3; // tmin ≤ 3 °C → geada
export const CALOR_C = 34; // tmax ≥ 34 °C → calor extremo
export const DIA_SECO_MM = 1; // precip < 1 mm → dia seco
export const GDD_BASE_C = 10; // base dos graus-dia do café (arábica)

const DIA_MS = 86_400_000;

function ymd(iso: string): string {
  return iso.slice(0, 10);
}

/** Desloca uma data ISO em `delta` dias (UTC, determinista). */
export function shiftDate(iso: string, delta: number): string {
  const t = new Date(`${ymd(iso)}T00:00:00Z`).getTime();
  return new Date(t + delta * DIA_MS).toISOString().slice(0, 10);
}

/**
 * Une dias novos ao diário: upsert por data (o observado mais recente vence),
 * ordena por data e mantém só os DIARY_MAX_DAYS mais recentes.
 */
export function mergeDays(existing: DiaryDay[], incoming: DiaryDay[]): DiaryDay[] {
  const byDate = new Map<string, DiaryDay>();
  for (const d of existing) byDate.set(ymd(d.date), { ...d, date: ymd(d.date) });
  for (const d of incoming) byDate.set(ymd(d.date), { ...d, date: ymd(d.date) });
  const all = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return all.length > DIARY_MAX_DAYS ? all.slice(all.length - DIARY_MAX_DAYS) : all;
}

export type ClimateSummary = {
  from: string | null;
  to: string | null;
  days: number;
  rain7: number;
  rain30: number;
  rain90: number;
  rainTotal: number;
  dryStreak: number; // dias secos seguidos terminando no último dia registrado
  frostCount: number; // total de geadas no histórico
  heatCount: number; // total de dias de calor extremo no histórico
  gddTotal: number; // graus-dia acumulados (base do café) no histórico
};

const round1 = (v: number) => Math.round(v * 10) / 10;

function rainWindow(days: DiaryDay[], today: string, n: number): number {
  const cutoff = shiftDate(today, -(n - 1));
  let soma = 0;
  for (const d of days) if (ymd(d.date) >= cutoff && ymd(d.date) <= today) soma += d.precip || 0;
  return round1(soma);
}

/** Agrega o diário em métricas de memória climática. `days` não precisa estar ordenado. */
export function summarizeClimate(days: DiaryDay[], today: string): ClimateSummary {
  if (days.length === 0) {
    return { from: null, to: null, days: 0, rain7: 0, rain30: 0, rain90: 0, rainTotal: 0, dryStreak: 0, frostCount: 0, heatCount: 0, gddTotal: 0 };
  }
  const ordenados = [...days].sort((a, b) => (ymd(a.date) < ymd(b.date) ? -1 : 1));
  let rainTotal = 0;
  let frostCount = 0;
  let heatCount = 0;
  let gddTotal = 0;
  for (const d of ordenados) {
    rainTotal += d.precip || 0;
    if (d.tmin <= GEADA_C) frostCount += 1;
    if (d.tmax >= CALOR_C) heatCount += 1;
    const media = (d.tmin + d.tmax) / 2;
    if (media > GDD_BASE_C) gddTotal += media - GDD_BASE_C;
  }
  // Veranico: dias secos consecutivos terminando no dia mais recente.
  let dryStreak = 0;
  for (let i = ordenados.length - 1; i >= 0; i -= 1) {
    if ((ordenados[i].precip || 0) < DIA_SECO_MM) dryStreak += 1;
    else break;
  }
  return {
    from: ymd(ordenados[0].date),
    to: ymd(ordenados[ordenados.length - 1].date),
    days: ordenados.length,
    rain7: rainWindow(ordenados, today, 7),
    rain30: rainWindow(ordenados, today, 30),
    rain90: rainWindow(ordenados, today, 90),
    rainTotal: round1(rainTotal),
    dryStreak,
    frostCount,
    heatCount,
    gddTotal: Math.round(gddTotal),
  };
}

/** Chuva total por mês (YYYY-MM), ordenado — para o gráfico de barras. */
export function rainByMonth(days: DiaryDay[]): { ym: string; mm: number }[] {
  const porMes = new Map<string, number>();
  for (const d of days) {
    const ym = ymd(d.date).slice(0, 7);
    porMes.set(ym, (porMes.get(ym) ?? 0) + (d.precip || 0));
  }
  return [...porMes.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([ym, mm]) => ({ ym, mm: round1(mm) }));
}
