import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { logSyncError } from "../../lib/syncError";
import { enqueueWrite, pendingIds } from "../../lib/syncOutbox";
import { mergeDays, type ClimateDiary, type DiaryDay } from "../../domain/climateDiary";

const STORAGE_KEY = "agryn.climate-diaries.v1";

type ClimateDiaryRow = { plot_id: string; days: DiaryDay[] | null; updated_at: string };

function diaryFromRow(row: ClimateDiaryRow): ClimateDiary {
  return {
    plotId: row.plot_id,
    days: Array.isArray(row.days) ? row.days : [],
    updatedAt: row.updated_at,
  };
}

export type ClimateDiaryController = {
  diaries: ClimateDiary[];
  diaryFor(plotId: string): ClimateDiary | null;
  capture(plotId: string, days: DiaryDay[]): void;
};

export function useClimateDiary(userId: string | null = null): ClimateDiaryController {
  const [diaries, setDiaries] = useState<ClimateDiary[]>(loadDiaries);
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(diaries));
  }, [diaries]);

  useEffect(() => {
    if (!userId) {
      if (previousUserId.current) {
        window.localStorage.removeItem(STORAGE_KEY);
        setDiaries([]);
      }
      previousUserId.current = null;
      return;
    }
    previousUserId.current = userId;

    let active = true;
    supabase
      .from("climate_diaries")
      .select("plot_id, days, updated_at")
      .then(({ data, error }) => {
        if (!active) return;
        logSyncError("diário climático", error);
        if (error) return;
        const cloud = ((data as ClimateDiaryRow[] | null) ?? []).map(diaryFromRow);
        const pend = pendingIds();
        const isPending = (plotId: string) => pend.has(`climate_diaries:${plotId}`);
        setDiaries((local) => {
          const cloudPlots = new Set(cloud.map((d) => d.plotId));
          const localByPlot = new Map(local.map((d) => [d.plotId, d]));
          // Talhão no cloud COM escrita local pendente: o local é mais novo — MESCLA
          // (união por data), não descarta. Senão um refetch antes do flush jogaria
          // fora dias acumulados (a memória do diário se perderia).
          const reconciled = cloud.map((c) => {
            const l = localByPlot.get(c.plotId);
            return l && isPending(c.plotId)
              ? { plotId: c.plotId, days: mergeDays(c.days, l.days), updatedAt: l.updatedAt }
              : c;
          });
          // Talhão local pendente ainda ausente no cloud.
          const soLocal = local.filter((d) => !cloudPlots.has(d.plotId) && isPending(d.plotId));
          return [...soLocal, ...reconciled];
        });
      });

    return () => {
      active = false;
    };
  }, [userId]);

  return {
    diaries,
    diaryFor(plotId) {
      return diaries.find((d) => d.plotId === plotId) ?? null;
    },
    capture(plotId, incoming) {
      if (incoming.length === 0) return;
      setDiaries((current) => {
        const existing = current.find((d) => d.plotId === plotId);
        const merged = mergeDays(existing?.days ?? [], incoming);
        // No-op quando nada muda: o clima recarrega a cada seleção de talhão, não
        // faz sentido reescrever/enfileirar se os dias já são os mesmos. Compara de
        // forma CANÔNICA (tupla por data): o jsonb do Postgres reordena as chaves do
        // objeto no round-trip, então um JSON.stringify cru daria falso-negativo e
        // reescreveria a cada carga.
        const canon = (ds: DiaryDay[]) => JSON.stringify(ds.map((d) => [d.date, d.tmin, d.tmax, d.precip]));
        if (existing && canon(existing.days) === canon(merged)) return current;
        const now = new Date().toISOString();
        const diary: ClimateDiary = { plotId, days: merged, updatedAt: now };
        const next = existing
          ? current.map((d) => (d.plotId === plotId ? diary : d))
          : [...current, diary];
        if (userId) {
          enqueueWrite({
            id: `climate_diaries:${plotId}`,
            table: "climate_diaries",
            onConflict: "user_id,plot_id",
            label: "diário climático",
            payload: { user_id: userId, plot_id: plotId, days: merged, updated_at: now },
          });
        }
        return next;
      });
    },
  };
}

function loadDiaries(): ClimateDiary[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}
