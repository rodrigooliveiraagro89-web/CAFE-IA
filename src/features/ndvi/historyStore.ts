import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { logSyncError } from "../../lib/syncError";
import { enqueueWrite } from "../../lib/syncOutbox";
import type { NdviResult } from "./types";

const HISTORY_KEY = "agryn.ndvi.history.v1";
const HISTORY_LIMIT = 24;

type NdviResultRow = {
  id: string;
  plot_id: string;
  acquired_at: string;
  processed_at: string;
  result: NdviResult;
};

export function useNdviHistory(userId: string | null = null) {
  const [history, setHistory] = useState<NdviResult[]>(loadHistory);
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history]);

  // Mesmo padrão de useFieldRecords/useAgriculturalContext: cache local para
  // carregamento instantâneo, nuvem manda assim que há conta logada, e limpa
  // o cache ao deslogar para não vazar histórico de uma conta pra outra no
  // mesmo navegador.
  useEffect(() => {
    if (!userId) {
      if (previousUserId.current) {
        window.localStorage.removeItem(HISTORY_KEY);
        setHistory([]);
      }
      previousUserId.current = null;
      return;
    }
    previousUserId.current = userId;

    let active = true;
    supabase
      .from("ndvi_results")
      .select("id, plot_id, acquired_at, processed_at, result")
      .order("acquired_at", { ascending: false })
      .limit(HISTORY_LIMIT)
      .then(({ data, error }) => {
        if (!active) return;
        logSyncError("histórico de NDVI", error);
        if (error) return;
        const rows = (data as NdviResultRow[] | null) ?? [];
        if (rows.length > 0) {
          setHistory(rows.map((row) => row.result));
        }
      });

    return () => {
      active = false;
    };
  }, [userId]);

  return {
    history,
    addResult(result: NdviResult) {
      setHistory((current) =>
        [result, ...current.filter((item) => item.id !== result.id)].slice(0, HISTORY_LIMIT),
      );
      if (userId) {
        // Outbox durável: NDVI criado offline sincroniza ao reconectar.
        enqueueWrite({
          id: `ndvi_results:${result.id}`,
          table: "ndvi_results",
          onConflict: "id",
          label: "novo resultado de NDVI",
          payload: {
            id: result.id,
            user_id: userId,
            plot_id: result.plotId,
            acquired_at: result.acquiredAt,
            processed_at: result.processedAt,
            result,
          },
        });
      }
    },
  };
}

function loadHistory(): NdviResult[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}
