import { supabase } from "../../lib/supabaseClient";

/** Preferência de notificação por usuário: nível mínimo de severidade e on/off. */
export type MinSeverity = "media" | "alta";
export type NotifPref = { minSeverity: MinSeverity; active: boolean };

export async function getNotifPref(): Promise<NotifPref> {
  const { data: userData } = await supabase.auth.getUser();
  const id = userData.user?.id;
  if (!id) return { minSeverity: "media", active: true };
  const { data } = await supabase
    .from("notification_preferences")
    .select("min_severity,active")
    .eq("user_id", id)
    .maybeSingle();
  return {
    minSeverity: (data?.min_severity as MinSeverity) ?? "media",
    active: data?.active ?? true,
  };
}

export async function setNotifPref(pref: NotifPref): Promise<boolean> {
  const { data: userData } = await supabase.auth.getUser();
  const id = userData.user?.id;
  if (!id) return false;
  const { error } = await supabase.from("notification_preferences").upsert(
    { user_id: id, min_severity: pref.minSeverity, active: pref.active, updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
  return !error;
}
