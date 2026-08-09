import { supabase } from "../../lib/supabaseClient";

/**
 * Web Push no cliente: assina o navegador para receber os alertas do cafezal
 * mesmo com o app fechado. A chave PÚBLICA VAPID é embutida (não é segredo); a
 * privada vive só na Edge Function que dispara as notificações.
 */

// Chave pública padrão (a mesma do deploy). Sobrescreve por VITE_VAPID_PUBLIC_KEY.
const DEFAULT_VAPID_PUBLIC_KEY =
  "BJQpXxGTYNTu8i0GcAELqTpkjLOjpI2jXzngNH61VoGtTA2_6-LqYrfZ4mM93NcxZnnataIgTgA6-eRoqLXDPKg";

function vapidPublicKey(): string {
  return (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined)?.trim() || DEFAULT_VAPID_PUBLIC_KEY;
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function pushPermission(): NotificationPermission {
  return typeof Notification !== "undefined" ? Notification.permission : "denied";
}

// base64url (VAPID) -> Uint8Array, formato exigido pelo PushManager.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  // Alocamos um ArrayBuffer concreto para o tipo casar com BufferSource
  // (applicationServerKey) sem cast — evita o SharedArrayBuffer genérico.
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

async function readyRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return navigator.serviceWorker.ready;
  await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
  return navigator.serviceWorker.ready;
}

/** Já existe uma assinatura ativa neste aparelho? */
export async function isSubscribed(): Promise<boolean> {
  if (!pushSupported()) return false;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return false;
  const subscription = await registration.pushManager.getSubscription();
  return Boolean(subscription);
}

export type EnableResult = { ok: boolean; reason?: string };

/** Pede permissão, assina e salva a assinatura no Supabase. */
export async function enablePush(): Promise<EnableResult> {
  if (!pushSupported()) return { ok: false, reason: "Este navegador não suporta notificações." };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, reason: "Permissão de notificação negada no navegador." };
  }

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { ok: false, reason: "Faça login para ativar as notificações." };

  const registration = await readyRegistration();
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey()),
    }));

  const json = subscription.toJSON();
  const endpoint = json.endpoint ?? "";
  const p256dh = json.keys?.p256dh ?? "";
  const auth = json.keys?.auth ?? "";
  if (!endpoint || !p256dh || !auth) {
    return { ok: false, reason: "Não foi possível criar a assinatura de notificação." };
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint,
      p256dh,
      auth,
      user_agent: navigator.userAgent.slice(0, 300),
    },
    { onConflict: "user_id,endpoint" },
  );
  if (error) return { ok: false, reason: "Falha ao salvar a assinatura. Tente de novo." };

  // Notificação local de confirmação — prova que o canal funciona na hora.
  await registration.showNotification("Notificações ativadas", {
    body: "Você receberá os alertas do cafezal por aqui.",
    icon: `${import.meta.env.BASE_URL}brand/agryn-mark.svg`,
    tag: "agryn-boas-vindas",
  });

  return { ok: true };
}

/** Cancela a assinatura neste aparelho e remove do Supabase. */
export async function disablePush(): Promise<EnableResult> {
  if (!pushSupported()) return { ok: true };
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  }
  return { ok: true };
}
