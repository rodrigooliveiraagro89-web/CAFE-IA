/**
 * Snapshot imutável da recomendação de adubação.
 *
 * Quando o técnico "emite" uma recomendação, guardamos uma cópia congelada dos
 * dados que a geraram (laudo, base/versão, parâmetros, NPK, calagem, programa e
 * custo) junto de um HASH SHA-256 do conteúdo canônico. O hash torna o registro
 * verificável: qualquer um recomputa o hash a partir dos campos salvos e
 * confere se bate — se alguém alterou o registro, o hash não fecha. É a prova
 * de que a dose assinada é exatamente a que saiu, na data que saiu.
 */

export type SnapshotParams = {
  vAlvo: number;
  cobertura: string; // fórmula principal recomendada (na 5ª, a formulação escolhida)
  fonteP?: string;
  fonteK?: string;
  sacas: number;
  plantasPorHa: number;
  fase?: string; // fase da lavoura (5ª): producao/formacao/...
  catalogo?: string; // versão do catálogo de fórmulas usado
};

export type SnapshotNpk = { n: number; p2o5: number; k2o: number; s: number };
export type SnapshotItem = { id: string; formula: string; kgPorHectare: number };

export type RecommendationSnapshot = {
  plotId: string;
  soilAnalysisId: string | null;
  engine: string;
  version: string;
  params: SnapshotParams;
  npk: SnapshotNpk;
  calagemTHa: number;
  programa: SnapshotItem[];
  custoHa: number;
  custoSaca: number;
};

/**
 * Serialização canônica: chaves ordenadas em todos os níveis, para que dois
 * conteúdos iguais gerem exatamente a mesma string (e o mesmo hash),
 * independentemente da ordem em que os campos foram montados.
 */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(",")}}`;
}

/** SHA-256 (hex) do conteúdo canônico do snapshot. */
export async function hashSnapshot(snapshot: RecommendationSnapshot): Promise<string> {
  const data = new TextEncoder().encode(canonicalize(snapshot));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Versão curta do hash para exibir/conferir a olho (primeiros 12 hex). */
export function shortHash(hash: string): string {
  return hash.slice(0, 12);
}
