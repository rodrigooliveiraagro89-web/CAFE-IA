import { supabase } from "../../lib/supabaseClient";
import { hashSnapshot, type RecommendationSnapshot } from "../../domain/recommendationSnapshot";

/**
 * Persiste um snapshot imutável da recomendação em recommendation_snapshots.
 * A tabela não tem policy de UPDATE/DELETE (RLS) — uma vez emitido, o registro
 * não muda. O hash é calculado no cliente sobre o conteúdo canônico.
 */

export type SavedSnapshot = {
  id: string;
  hash: string;
  createdAt: string;
};

export type SnapshotListItem = {
  id: string;
  hash: string;
  createdAt: string;
  cobertura: string;
  custoSaca: number;
};

export async function saveSnapshot(
  snap: RecommendationSnapshot,
): Promise<{ ok: true; saved: SavedSnapshot } | { ok: false; reason: string }> {
  const hash = await hashSnapshot(snap);
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { ok: false, reason: "Faça login para registrar a recomendação." };

  const { data, error } = await supabase
    .from("recommendation_snapshots")
    .insert({
      user_id: userId,
      plot_id: snap.plotId,
      soil_analysis_id: snap.soilAnalysisId,
      engine: snap.engine,
      version: snap.version,
      params: snap.params,
      npk: snap.npk,
      calagem_t_ha: snap.calagemTHa,
      programa: snap.programa,
      custo_ha: snap.custoHa,
      custo_saca: snap.custoSaca,
      hash,
    })
    .select("id, created_at")
    .single();

  if (error || !data) {
    return {
      ok: false,
      reason: "Não foi possível registrar. A tabela recommendation_snapshots existe no Supabase?",
    };
  }
  return { ok: true, saved: { id: data.id as string, hash, createdAt: data.created_at as string } };
}

export async function listSnapshots(plotId: string): Promise<SnapshotListItem[]> {
  const { data } = await supabase
    .from("recommendation_snapshots")
    .select("id, hash, created_at, params, custo_saca")
    .eq("plot_id", plotId)
    .order("created_at", { ascending: false })
    .limit(10);
  return ((data as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
    id: String(row.id),
    hash: String(row.hash ?? ""),
    createdAt: String(row.created_at ?? ""),
    cobertura: String((row.params as { cobertura?: string } | null)?.cobertura ?? ""),
    custoSaca: Number(row.custo_saca ?? 0),
  }));
}
