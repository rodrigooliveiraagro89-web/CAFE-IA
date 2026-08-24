import { supabase } from "../../lib/supabaseClient";
import type { Recomendacao5a } from "../../domain/coffeeFertility5a";

/**
 * Persistência da recomendação 5ª Aproximação por talhão (histórico com data e
 * proveniência). Guarda o resultado calculado — o que foi recomendado fica
 * auditável, independente de mudanças futuras no motor ou no laudo.
 */

export type SavedRecommendation = {
  id: string;
  plotId: string;
  fase: string | null;
  produtividadeSc: number | null;
  createdAt: string;
  payload: Recomendacao5a;
};

type Row = {
  id: string;
  plot_id: string;
  fase: string | null;
  produtividade_sc: number | null;
  created_at: string;
  payload: Recomendacao5a;
};

function fromRow(row: Row): SavedRecommendation {
  return {
    id: row.id,
    plotId: row.plot_id,
    fase: row.fase,
    produtividadeSc: row.produtividade_sc,
    createdAt: row.created_at,
    payload: row.payload,
  };
}

export async function saveRecommendation(
  plotId: string,
  rec: Recomendacao5a,
): Promise<SavedRecommendation | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;
  const { data, error } = await supabase
    .from("fertility_recommendations")
    .insert({
      user_id: userId,
      plot_id: plotId,
      fase: rec.fase,
      produtividade_sc: rec.produtividade_calculo_sc_ha,
      payload: rec,
    })
    .select()
    .single();
  if (error || !data) return null;
  return fromRow(data as Row);
}

export async function listRecommendations(plotId: string): Promise<SavedRecommendation[]> {
  const { data, error } = await supabase
    .from("fertility_recommendations")
    .select("*")
    .eq("plot_id", plotId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error || !data) return [];
  return (data as Row[]).map(fromRow);
}
