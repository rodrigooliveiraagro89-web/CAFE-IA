import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { logSyncError } from "../../lib/syncError";
import { enqueueWrite } from "../../lib/syncOutbox";
import type { SoilValues } from "../../domain/soilAnalysis";
import { demoSoil } from "../onboarding/demoData";

const STORAGE_KEY = "agryn.soil-analyses.v1";
const LIMIT = 50;

export type SoilSource = "foto" | "pdf" | "manual";

export type SoilAnalysis = {
  id: string;
  plotId: string;
  analysisDate: string | null;
  laboratory: string | null;
  source: SoilSource;
  values: SoilValues;
  createdAt: string;
};

type SoilAnalysisRow = {
  id: string;
  plot_id: string;
  analysis_date: string | null;
  laboratory: string | null;
  source: SoilSource;
  values: SoilValues;
  created_at: string;
};

function analysisFromRow(row: SoilAnalysisRow): SoilAnalysis {
  return {
    id: row.id,
    plotId: row.plot_id,
    analysisDate: row.analysis_date,
    laboratory: row.laboratory,
    source: row.source,
    values: row.values,
    createdAt: row.created_at,
  };
}

export function useSoilAnalyses(userId: string | null = null, demoActive = false) {
  const [analyses, setAnalyses] = useState<SoilAnalysis[]>(loadAnalyses);
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    if (demoActive) return; // não persiste dados de exemplo
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(analyses));
  }, [analyses, demoActive]);

  useEffect(() => {
    if (demoActive) return; // no modo demo, a nuvem não manda
    if (!userId) {
      if (previousUserId.current) {
        window.localStorage.removeItem(STORAGE_KEY);
        setAnalyses([]);
      }
      previousUserId.current = null;
      return;
    }
    previousUserId.current = userId;

    let active = true;
    supabase
      .from("soil_analyses")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(LIMIT)
      .then(({ data, error }) => {
        if (!active) return;
        logSyncError("análises de solo", error);
        if (error) return;
        const rows = (data as SoilAnalysisRow[] | null) ?? [];
        if (rows.length > 0) {
          setAnalyses(rows.map(analysisFromRow));
        }
      });

    return () => {
      active = false;
    };
  }, [userId, demoActive]);

  return {
    analyses: demoActive ? demoSoil : analyses,
    addAnalysis(input: Omit<SoilAnalysis, "id" | "createdAt">) {
      const id = crypto.randomUUID();
      const analysis: SoilAnalysis = { ...input, id, createdAt: new Date().toISOString() };
      if (demoActive) return id; // no modo demo não grava nada
      setAnalyses((current) => [analysis, ...current].slice(0, LIMIT));
      if (userId) {
        // Outbox durável: se estiver offline, envia ao reconectar (não fica órfão).
        enqueueWrite({
          id: `soil_analyses:${id}`,
          table: "soil_analyses",
          onConflict: "id",
          label: "nova análise de solo",
          payload: {
            id,
            user_id: userId,
            plot_id: input.plotId,
            analysis_date: input.analysisDate,
            laboratory: input.laboratory,
            source: input.source,
            values: input.values,
          },
        });
      }
      return id;
    },
  };
}

function loadAnalyses(): SoilAnalysis[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}
