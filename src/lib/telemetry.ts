import { supabase } from "./supabaseClient";

/**
 * Telemetria first-party: registra erros de cliente e eventos de uso na tabela
 * client_events do próprio Supabase — nada vai para terceiros (LGPD). Objetivo:
 * saber o que quebra no campo e quais módulos são usados, para priorizar. É
 * best-effort: se a gravação falhar, o app nunca quebra por causa disso.
 *
 * Privacidade: nunca gravamos query strings (podem ter dado pessoal) além do
 * `view`; nem corpo de formulário. Só mensagem de erro, rota e versão.
 */

export type EventKind = "error" | "view" | "app_open";

export type ClientEventRow = {
  kind: EventKind;
  message: string;
  context: Record<string, unknown>;
  path: string;
  app_version: string;
  user_agent: string;
};

export const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string | undefined)?.trim() || "dev";

const MAX_MESSAGE = 500;
const MAX_UA = 300;

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

/**
 * Reduz uma URL ao que é seguro registrar: o caminho e, no máximo, o parâmetro
 * `view` (identifica a tela, não é dado pessoal). Todo o resto da query é
 * descartado para não vazar informação sensível.
 */
export function sanitizePath(href: string): string {
  try {
    const url = new URL(href);
    const view = url.searchParams.get("view");
    return view ? `${url.pathname}?view=${encodeURIComponent(view)}` : url.pathname;
  } catch {
    return "";
  }
}

/** Constrói a linha de evento (pura, testável — sem I/O). */
export function buildEventRow(
  kind: EventKind,
  message: string,
  context: Record<string, unknown>,
  env: { href: string; userAgent: string; appVersion?: string },
): ClientEventRow {
  return {
    kind,
    message: truncate(message ?? "", MAX_MESSAGE),
    context: context ?? {},
    path: sanitizePath(env.href),
    app_version: env.appVersion ?? APP_VERSION,
    user_agent: truncate(env.userAgent ?? "", MAX_UA),
  };
}

/** Assinatura para deduplicar erros repetidos na mesma sessão. */
export function eventSignature(kind: EventKind, message: string): string {
  return `${kind}:${message}`.slice(0, 160);
}

const seenErrors = new Set<string>();

function currentEnv() {
  return {
    href: typeof window !== "undefined" ? window.location.href : "",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
  };
}

async function send(row: ClientEventRow): Promise<void> {
  try {
    await supabase.from("client_events").insert(row);
  } catch {
    // Best-effort: telemetria nunca derruba o app.
  }
}

export function logError(message: string, context: Record<string, unknown> = {}): void {
  const signature = eventSignature("error", message);
  if (seenErrors.has(signature)) return; // não floodar com o mesmo erro
  seenErrors.add(signature);
  void send(buildEventRow("error", message, context, currentEnv()));
}

export function logEvent(kind: Exclude<EventKind, "error">, message = "", context: Record<string, unknown> = {}): void {
  void send(buildEventRow(kind, message, context, currentEnv()));
}

let inited = false;

/** Registra os captadores globais de erro. Chamar uma vez, no boot do app. */
export function initTelemetry(): void {
  if (inited || typeof window === "undefined") return;
  inited = true;

  window.addEventListener("error", (event) => {
    logError(event.message || "Erro de script", {
      source: event.filename,
      line: event.lineno,
      column: event.colno,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message =
      reason instanceof Error ? reason.message : typeof reason === "string" ? reason : "Promessa rejeitada";
    logError(`Rejeição não tratada: ${message}`);
  });

  logEvent("app_open");
}
