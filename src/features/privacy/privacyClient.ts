import { supabase } from "../../lib/supabaseClient";
import { fetchWithTimeout, DEFAULT_TIMEOUT_MS } from "../../lib/http";

// Tabelas do usuário no Supabase (escopadas por RLS ao próprio dono).
const USER_TABLES: { table: string; column: string }[] = [
  { table: "profiles", column: "id" },
  { table: "properties", column: "user_id" },
  { table: "plots", column: "user_id" },
  { table: "field_records", column: "user_id" },
  { table: "ndvi_results", column: "user_id" },
  { table: "soil_analyses", column: "user_id" },
];

export type ExportedData = {
  exportadoEm: string;
  usuarioId: string;
  supabase: Record<string, unknown[]>;
  local: Record<string, unknown>;
};

/**
 * Reúne todos os dados do usuário para o direito de portabilidade (LGPD).
 * Puxa as tabelas do Supabase (a RLS garante que só vêm as linhas dele) e os
 * dados guardados localmente no navegador (prefixo `agryn.`).
 */
export async function exportUserData(userId: string): Promise<ExportedData> {
  const supabaseData: Record<string, unknown[]> = {};
  for (const { table, column } of USER_TABLES) {
    const { data, error } = await supabase.from(table).select("*").eq(column, userId);
    if (error) {
      throw new Error(`Falha ao exportar ${table}: ${error.message}`);
    }
    supabaseData[table] = data ?? [];
  }

  const local: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith("agryn.")) continue;
    const raw = localStorage.getItem(key);
    if (raw === null) continue;
    try {
      local[key] = JSON.parse(raw);
    } catch {
      local[key] = raw;
    }
  }

  return {
    exportadoEm: new Date().toISOString(),
    usuarioId: userId,
    supabase: supabaseData,
    local,
  };
}

/** Dispara o download do JSON no navegador. */
export function downloadJson(data: ExportedData) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const carimbo = data.exportadoEm.slice(0, 10);
  link.href = url;
  link.download = `agryn-meus-dados-${carimbo}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Exclui a conta e todos os dados do usuário via Edge Function (service role).
 * O cliente não pode apagar o usuário do auth, por isso a função no servidor faz
 * a exclusão após verificar o JWT do próprio usuário.
 */
export async function deleteAccount(accessToken: string): Promise<void> {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const response = await fetchWithTimeout(
    `${url}/functions/v1/delete-account`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: anonKey,
        "Content-Type": "application/json",
      },
    },
    DEFAULT_TIMEOUT_MS,
  );

  if (!response.ok) {
    let mensagem = "Não foi possível excluir a conta agora. Tente novamente.";
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload.error) mensagem = payload.error;
    } catch {
      // mantém a mensagem padrão
    }
    throw new Error(mensagem);
  }

  // Limpa qualquer dado local remanescente deste dispositivo.
  const chaves: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key && key.startsWith("agryn.")) chaves.push(key);
  }
  chaves.forEach((key) => localStorage.removeItem(key));
}
