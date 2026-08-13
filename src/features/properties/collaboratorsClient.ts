import { supabase } from "../../lib/supabaseClient";

/**
 * Colaboração: o dono de uma propriedade convida (por e-mail) alguém para
 * VER a propriedade em leitura. A tabela property_collaborators tem RLS que
 * só deixa o dono inserir/revogar; o convidado passa a enxergar a propriedade
 * e seus dados via as funções can_view_property/can_view_plot.
 */

export type Collaborator = {
  id: string;
  invitedEmail: string;
  role: string;
  status: string;
  createdAt: string;
};

export async function listCollaborators(propertyId: string): Promise<Collaborator[]> {
  const { data } = await supabase
    .from("property_collaborators")
    .select("id, invited_email, role, status, created_at")
    .eq("property_id", propertyId)
    .order("created_at", { ascending: true });
  return ((data as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
    id: String(row.id),
    invitedEmail: String(row.invited_email ?? ""),
    role: String(row.role ?? "viewer"),
    status: String(row.status ?? "active"),
    createdAt: String(row.created_at ?? ""),
  }));
}

export async function inviteCollaborator(
  propertyId: string,
  email: string,
): Promise<{ ok: true; collaborator: Collaborator } | { ok: false; reason: string }> {
  const clean = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
    return { ok: false, reason: "Informe um e-mail válido." };
  }
  const { data: userData } = await supabase.auth.getUser();
  const ownerId = userData.user?.id;
  if (!ownerId) return { ok: false, reason: "Faça login para compartilhar." };

  const { data, error } = await supabase
    .from("property_collaborators")
    .insert({
      property_id: propertyId,
      owner_id: ownerId,
      invited_email: clean,
      role: "viewer",
      status: "active",
    })
    .select("id, invited_email, role, status, created_at")
    .single();

  if (error || !data) {
    const duplicada = (error?.code === "23505" || /duplicate|unique/i.test(error?.message ?? ""));
    return {
      ok: false,
      reason: duplicada ? "Esse e-mail já foi convidado para esta propriedade." : "Não foi possível convidar. Tente de novo.",
    };
  }
  return {
    ok: true,
    collaborator: {
      id: String(data.id),
      invitedEmail: String(data.invited_email),
      role: String(data.role),
      status: String(data.status),
      createdAt: String(data.created_at),
    },
  };
}

export async function revokeCollaborator(id: string): Promise<boolean> {
  const { error } = await supabase.from("property_collaborators").delete().eq("id", id);
  return !error;
}
