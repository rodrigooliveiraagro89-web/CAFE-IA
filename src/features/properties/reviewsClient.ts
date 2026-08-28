import { supabase } from "../../lib/supabaseClient";

/**
 * Pareceres técnicos (technical_reviews) — o consultor↔produtor (§22).
 *
 * Um colaborador 'agronomist' (consultor) OU o dono registra um parecer técnico
 * na propriedade. Todo mundo que enxerga a propriedade (dono + colaboradores)
 * lê os pareceres. A RLS garante que só o autor edita/apaga o seu, e que só
 * dono/consultor da PRÓPRIA propriedade escreve (policies corrigidas — antes
 * havia furo cross-tenant). O reviewer_id vem do auth; o nome, do perfil.
 */

export type TechnicalReview = {
  id: string;
  propertyId: string;
  plotId: string | null;
  reviewerId: string;
  reviewerName: string;
  status: string;
  notes: string;
  createdAt: string;
};

function fromRow(row: Record<string, unknown>): TechnicalReview {
  return {
    id: String(row.id),
    propertyId: String(row.property_id),
    plotId: row.plot_id ? String(row.plot_id) : null,
    reviewerId: String(row.reviewer_id),
    reviewerName: String(row.reviewer_name ?? ""),
    status: String(row.status ?? ""),
    notes: String(row.notes ?? ""),
    createdAt: String(row.created_at ?? ""),
  };
}

const SELECT = "id, property_id, plot_id, reviewer_id, reviewer_name, status, notes, created_at";

export async function listReviews(propertyId: string): Promise<TechnicalReview[]> {
  const { data, error } = await supabase
    .from("technical_reviews")
    .select(SELECT)
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data as Array<Record<string, unknown>> | null) ?? []).map(fromRow);
}

/** O usuário pode registrar parecer nesta propriedade? (dono ou consultor ativo.) */
export async function canReviewProperty(propertyId: string): Promise<boolean> {
  const { data } = await supabase.rpc("can_review_property", { prop: propertyId });
  return data === true;
}

export async function createReview(
  propertyId: string,
  notes: string,
  opts: { plotId?: string | null; status?: string } = {},
): Promise<{ ok: true; review: TechnicalReview } | { ok: false; reason: string }> {
  const clean = notes.trim();
  if (!clean) return { ok: false, reason: "Escreva o parecer antes de registrar." };

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { ok: false, reason: "Faça login para registrar o parecer." };

  // reviewer_name NÃO é enviado pelo cliente: um trigger no servidor o preenche a
  // partir do perfil do autenticado, para não permitir forjar a autoria.
  const { data, error } = await supabase
    .from("technical_reviews")
    .insert({
      property_id: propertyId,
      plot_id: opts.plotId ?? null,
      reviewer_id: user.id,
      status: opts.status ?? "emitido",
      notes: clean,
    })
    .select(SELECT)
    .single();

  if (error || !data) {
    return {
      ok: false,
      reason: "Não foi possível registrar. É preciso ter acesso de consultor técnico a esta propriedade.",
    };
  }
  return { ok: true, review: fromRow(data) };
}

export async function deleteReview(id: string): Promise<boolean> {
  // .select() devolve as linhas de fato apagadas (sujeitas à RLS): se a política
  // bloqueou, vem vazio e retornamos false — a UI não remove um parecer que ficou.
  const { data, error } = await supabase.from("technical_reviews").delete().eq("id", id).select("id");
  return !error && Array.isArray(data) && data.length > 0;
}
