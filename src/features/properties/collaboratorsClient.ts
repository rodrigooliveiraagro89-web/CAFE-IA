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

/**
 * Ao logar, vincula o member_id nos convites feitos ao e-mail do usuário (que
 * ainda estavam só por e-mail). Deixa a colaboração robusta — o RLS passa a
 * casar por member_id, não só pelo e-mail do JWT. Best-effort e idempotente.
 */
export async function linkPendingCollaborations(): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user?.email) return;
    await supabase
      .from("property_collaborators")
      .update({ member_id: user.id, status: "active" })
      .is("member_id", null)
      .ilike("invited_email", user.email);
  } catch {
    // best-effort: nunca derruba o app por causa disto
  }
}

/** Texto e link prontos para o dono enviar o convite (WhatsApp, etc.). */
export function inviteMessage(propertyName: string, email: string): { texto: string; url: string; whatsapp: string } {
  const appUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${import.meta.env.BASE_URL ?? "/"}`
      : "https://rodrigooliveiraagro89-web.github.io/CAFE-IA/";
  const texto =
    `Compartilhei a propriedade "${propertyName}" com você no AGRYN (acesso de leitura).\n` +
    `Entre com este e-mail: ${email}\n` +
    `Acesse: ${appUrl}`;
  return { texto, url: appUrl, whatsapp: `https://wa.me/?text=${encodeURIComponent(texto)}` };
}
