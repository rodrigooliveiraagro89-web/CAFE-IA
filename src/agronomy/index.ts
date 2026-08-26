/**
 * Camada agronômica determinística do AGRYN (isolada da UI). Ponto único de
 * import: `import { ... } from "../../agronomy"`. Por ora o cálculo vive em
 * engine5a.ts; será dividido em engines (nutrient/liming/gypsum/fertilizer)
 * atrás deste mesmo barrel, sem quebrar quem importa.
 */
export * from "./engine5a";
