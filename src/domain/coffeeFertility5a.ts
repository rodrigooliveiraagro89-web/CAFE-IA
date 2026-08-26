/**
 * FACHADA ESTÁVEL — o motor da 5ª Aproximação foi movido para /src/agronomy.
 * Este arquivo re-exporta tudo para não quebrar os imports existentes
 * (`from "../../domain/coffeeFertility5a"`). Novos consumidores podem importar
 * direto de "../../agronomy". Ver [[Fase 1.1]] do dossiê de arquitetura.
 */
export * from "../agronomy";
