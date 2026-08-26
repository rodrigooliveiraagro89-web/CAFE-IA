/**
 * Camada agronômica determinística do AGRYN (isolada da UI). Ponto único de
 * import: `import { ... } from "../../agronomy"`. Dividida em: types (tipos),
 * core (primitivas + índices) e engine5a (classificação, correção, nutrientes,
 * fertilizantes, cronograma e o orquestrador). Barrel estável — quem importa
 * não muda quando novos engines forem extraídos.
 */
export * from "./types";
export * from "./core";
export * from "./engine5a";
