/**
 * Balanço hídrico simplificado e chuva acumulada — a partir da série diária
 * (Open-Meteo com past_days). Puro e testável. Responde "quanto choveu" e "qual
 * o déficit acumulado (chuva − ET0)". NÃO é recomendação precisa de irrigação:
 * depende de solo, cultura/fase e eficiência (ausentes aqui) — é indicativo.
 */

export type BalanceDay = {
  date: string; // YYYY-MM-DD
  precipitation: number; // mm
  et0: number | null; // evapotranspiração de referência (mm)
};

export type ObservedWindow = { dias: number; chuva: number; et0: number | null; balanco: number | null };
export type ForecastWindow = { dias: number; chuva: number };

export type WaterBalance = {
  observado: ObservedWindow[]; // últimos 7, 15, 30 dias
  previsto: ForecastWindow[]; // próximos 3, 7 dias
};

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

/** Divide a série em passado (antes de hoje) e futuro (hoje em diante). */
export function computeWaterBalance(dias: BalanceDay[], todayISO: string): WaterBalance {
  const today = todayISO.slice(0, 10);
  const ordenado = [...dias].sort((a, b) => a.date.localeCompare(b.date));
  const passado = ordenado.filter((d) => d.date.slice(0, 10) < today);
  const futuro = ordenado.filter((d) => d.date.slice(0, 10) >= today);

  const observado = [7, 15, 30].map<ObservedWindow>((n) => {
    const seg = passado.slice(-n);
    if (seg.length === 0) return { dias: n, chuva: 0, et0: null, balanco: null };
    const chuva = seg.reduce((s, d) => s + (d.precipitation || 0), 0);
    const temEt0 = seg.some((d) => d.et0 != null);
    const et0 = temEt0 ? seg.reduce((s, d) => s + (d.et0 ?? 0), 0) : null;
    return {
      dias: n,
      chuva: round1(chuva),
      et0: et0 != null ? round1(et0) : null,
      balanco: et0 != null ? round1(chuva - et0) : null,
    };
  });

  const previsto = [3, 7].map<ForecastWindow>((n) => {
    const seg = futuro.slice(0, n);
    return { dias: n, chuva: round1(seg.reduce((s, d) => s + (d.precipitation || 0), 0)) };
  });

  return { observado, previsto };
}
