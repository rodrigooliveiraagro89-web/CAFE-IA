// Sincroniza a cópia da Edge Function com a fonte única dos alertas.
//
// A regra dos alertas (limiares, NDVI/solo/atividades, calendário) mora em
// src/domain/alertRules.ts e é usada pelo app. A Edge Function push-alerts roda
// no Deno (Supabase) e precisa do MESMO código; como o bundle do deploy só
// enxerga arquivos dentro da pasta da função, mantemos aqui uma CÓPIA gerada.
//
// Este script reescreve a cópia a partir do original. O teste
// src/domain/alertRules.sync.test.ts falha se a cópia divergir — então, ao
// mexer no original, rode:  npm run sync:alert-rules
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const SOURCE = resolve(root, "src/domain/alertRules.ts");
const COPY = resolve(root, "supabase/functions/push-alerts/alertRules.ts");

export const BANNER = [
  "// AUTO-SINCRONIZADO com src/domain/alertRules.ts (fonte única dos alertas).",
  "// NÃO edite aqui — edite o original e rode: npm run sync:alert-rules",
  "// (o teste alertRules.sync.test.ts falha se este arquivo divergir do original).",
].join("\n");

export function buildCopy(sourceContent) {
  // Normaliza para LF: o conteúdo é comparado byte a byte pelo teste-guarda.
  const body = sourceContent.replace(/\r\n/g, "\n");
  return `${BANNER}\n\n${body}`;
}

function main() {
  const source = readFileSync(SOURCE, "utf8");
  writeFileSync(COPY, buildCopy(source), "utf8");
  console.log(`alertRules.ts sincronizado -> ${COPY}`);
}

// Só executa quando chamado direto (não quando importado pelo teste).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
