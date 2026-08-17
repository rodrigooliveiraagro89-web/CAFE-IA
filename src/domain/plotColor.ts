/**
 * Cor estável por talhão — para os limites ficarem visualmente distintos no
 * mapa (como as medições coloridas do FAMS) SEM precisar de coluna nova no
 * banco: derivamos a cor do id do talhão. Mesmo id → mesma cor, sempre.
 */

// Paleta de alto contraste sobre imagem de satélite (verde-escuro do fundo).
const PALETTE = [
  "#22c55e", // verde
  "#f97316", // laranja
  "#38bdf8", // azul-céu
  "#a855f7", // roxo
  "#eab308", // amarelo
  "#ec4899", // rosa
  "#14b8a6", // teal
  "#ef4444", // vermelho
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Cor determinística para um talhão a partir do seu id. */
export function plotColor(id: string): string {
  return PALETTE[hashString(id) % PALETTE.length];
}
