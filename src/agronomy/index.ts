/**
 * Camada agronômica determinística do AGRYN (isolada da UI). Ponto único de
 * import: `import { ... } from "../../agronomy"`.
 *
 *   types            tipos (0 lógica)
 *   core             num, round, calcularIndices
 *   soilEngine       classificação: classes gerais, P, S, micros
 *   correctionEngine calagem + corretivo + gessagem
 *   nutrientEngine   necessidade de N/P/K/S por fase; doses por planta
 *   fertilizerEngine fontes de micros, conversão, formulação, lista de compras
 *   scheduleEngine   cronograma de parcelamento
 *   rules            versão das regras + validação de faixas plausíveis
 *   engine5a         recomendarNutrientes5a (orquestrador) + FASE_LABEL
 *
 * Barrel estável — quem importa não muda quando os engines são reorganizados.
 */
export * from "./types";
export * from "./core";
export * from "./soilEngine";
export * from "./correctionEngine";
export * from "./nutrientEngine";
export * from "./fertilizerEngine";
export * from "./scheduleEngine";
export * from "./rules";
export * from "./engine5a";
