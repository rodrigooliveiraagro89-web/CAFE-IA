/**
 * Fila de sincronização durável (outbox) — Fase 1.3.
 *
 * Escritas feitas offline (ou que falham por rede) ficam persistidas no
 * localStorage e são reenviadas automaticamente quando a conexão volta, em vez
 * de se perderem num fire-and-forget. Resolve o bug de análises de solo e
 * resultados de NDVI criados offline ficarem órfãos no aparelho.
 *
 * Só faz UPSERT (idempotente por id) — reenviar a mesma operação é seguro.
 * A RLS do Supabase garante que cada usuário só grava o que é seu (o payload
 * carrega user_id).
 */
import { supabase } from "./supabaseClient";
import { logSyncError } from "./syncError";

const OUTBOX_KEY = "agryn.outbox.v1";

export type OutboxOp = {
  id: string; // chave de deduplicação, ex.: "soil_analyses:<uuid>"
  table: string;
  payload: Record<string, unknown>;
  onConflict?: string; // coluna de conflito do upsert (normalmente "id")
  label: string; // rótulo para o log
};

function load(): OutboxOp[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const v = JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? "[]");
    return Array.isArray(v) ? (v as OutboxOp[]) : [];
  } catch {
    return [];
  }
}

function save(ops: OutboxOp[]) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(ops));
  } catch {
    // sem persistência disponível — segue só em memória do processo
  }
}

export function pendingCount(): number {
  return load().length;
}

let flushing = false;

/** Reenvia o que estiver na fila. Mantém na fila o que falhar (nova tentativa). */
export async function flushOutbox(): Promise<void> {
  if (flushing) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  const ops = load();
  if (ops.length === 0) return;
  flushing = true;
  try {
    const remaining: OutboxOp[] = [];
    for (const op of ops) {
      const { error } = await supabase
        .from(op.table)
        .upsert(op.payload, op.onConflict ? { onConflict: op.onConflict } : undefined);
      if (error) {
        logSyncError(op.label, error);
        remaining.push(op); // mantém para tentar de novo depois
      }
    }
    save(remaining);
  } finally {
    flushing = false;
  }
}

/** Enfileira uma escrita durável e tenta enviar já (se online). */
export function enqueueWrite(op: OutboxOp): void {
  const ops = load().filter((o) => o.id !== op.id); // dedup: a mais recente vence
  ops.push(op);
  save(ops);
  void flushOutbox();
}

let initialized = false;

/** Instala o auto-flush no reconnect + tentativa inicial. Idempotente. */
export function initOutbox(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  window.addEventListener("online", () => void flushOutbox());
  void flushOutbox();
}
