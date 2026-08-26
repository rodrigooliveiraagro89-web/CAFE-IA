import { describe, expect, it } from "vitest";
// `?raw` (tipado por vite/client) traz o conteúdo dos arquivos como string, sem
// depender de APIs de Node — assim o teste typecheca sob tsconfig.app (vite/client).
import sourceRaw from "./alertRules.ts?raw";
import copyRaw from "../../supabase/functions/push-alerts/alertRules.ts?raw";

/**
 * Guarda anti-drift: a Edge Function push-alerts roda no Deno e recebe uma
 * cópia de src/domain/alertRules.ts (gerada por `npm run sync:alert-rules`).
 * Este teste garante que a cópia é idêntica à fonte — se alguém mexer no
 * original sem sincronizar, o CI falha aqui em vez de deixar o push divergir
 * do app silenciosamente. O cabeçalho abaixo espelha o do script gerador.
 */
const BANNER = [
  "// AUTO-SINCRONIZADO com src/domain/alertRules.ts (fonte única dos alertas).",
  "// NÃO edite aqui — edite o original e rode: npm run sync:alert-rules",
  "// (o teste alertRules.sync.test.ts falha se este arquivo divergir do original).",
].join("\n");

const lf = (s: string) => s.replace(/\r\n/g, "\n");

describe("alertRules — fonte única app/push", () => {
  it("a cópia da Edge Function está sincronizada com o original", () => {
    const esperado = `${BANNER}\n\n${lf(sourceRaw)}`;
    expect(lf(copyRaw)).toBe(esperado);
  });
});
