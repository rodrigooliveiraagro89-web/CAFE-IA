/**
 * Log único de falha de sincronização (antes duplicado em 4 stores). Best-effort
 * — nunca lança; só registra para diagnóstico.
 */
export function logSyncError(action: string, error: { message: string } | null) {
  if (error) console.error(`[agryn] falha ao sincronizar ${action}:`, error.message);
}
