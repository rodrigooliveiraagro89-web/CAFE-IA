/**
 * Calculadoras agronômicas — lógica pura, portada do app clássico (agryn.html).
 *
 * As fórmulas são as mesmas já validadas em campo; aqui elas ficam isoladas em
 * funções testáveis, sem estado nem UI, para poderem alimentar tanto a tela das
 * calculadoras quanto o plano de adubação (g/planta) e o relatório.
 */

const METROS_QUADRADOS_POR_HECTARE = 10_000;
// Medidas agrárias tradicionais ainda usadas na negociação de terra em MG/SP.
const HECTARES_POR_ALQUEIRE_PAULISTA = 2.42;
const HECTARES_POR_ALQUEIRE_MINEIRO = 4.84;

export type EspacamentoInput = {
  /** Distância entre linhas de plantio, em metros. */
  entreLinhas: number;
  /** Distância entre plantas na linha, em metros. */
  entrePlantas: number;
  /** Área do talhão, em hectares. */
  area: number;
  /** Dose do produto por hectare, em g ou mL. */
  dose: number;
};

export type EspacamentoResult = {
  plantasPorHa: number;
  /** Dose por planta, na mesma unidade da dose informada. `null` sem estande. */
  produtoPorPlanta: number | null;
  /** Total de produto para a área, convertido de g/mL para kg/L. */
  totalProduto: number;
};

export function calcularEspacamento(input: EspacamentoInput): EspacamentoResult {
  const { entreLinhas, entrePlantas, area, dose } = input;
  const plantasPorHa =
    entreLinhas > 0 && entrePlantas > 0
      ? Math.round(METROS_QUADRADOS_POR_HECTARE / (entreLinhas * entrePlantas))
      : 0;

  return {
    plantasPorHa,
    produtoPorPlanta: plantasPorHa > 0 ? dose / plantasPorHa : null,
    totalProduto: (dose * area) / 1000,
  };
}

export type PulverizacaoInput = {
  /** Volume de calda aplicado por hectare, em litros. */
  volumeCalda: number;
  /** Capacidade do tanque do pulverizador, em litros. */
  tanque: number;
  /** Dose do produto por litro de calda, em g ou mL. */
  dose: number;
  /** Área a pulverizar, em hectares. */
  area: number;
};

export type PulverizacaoResult = {
  litrosAguaTotal: number;
  /** Total de produto na operação, convertido de g/mL para kg/L. */
  produtoTotal: number;
  /** Tanques cheios necessários (arredondado para cima). */
  numeroTanques: number;
};

export function calcularPulverizacao(input: PulverizacaoInput): PulverizacaoResult {
  const { volumeCalda, tanque, dose, area } = input;
  const litrosAguaTotal = volumeCalda * area;

  return {
    litrosAguaTotal,
    produtoTotal: (dose * litrosAguaTotal) / 1000,
    numeroTanques: tanque > 0 ? Math.ceil(litrosAguaTotal / tanque) : 0,
  };
}

export type ConversaoAreaResult = {
  metrosQuadrados: number;
  alqueirePaulista: number;
  alqueireMineiro: number;
};

export function converterArea(hectares: number): ConversaoAreaResult {
  return {
    metrosQuadrados: hectares * METROS_QUADRADOS_POR_HECTARE,
    alqueirePaulista: hectares / HECTARES_POR_ALQUEIRE_PAULISTA,
    alqueireMineiro: hectares / HECTARES_POR_ALQUEIRE_MINEIRO,
  };
}

/**
 * Converte uma dose por hectare (kg/ha) em gramas por planta, usando o estande.
 * É o elo entre as calculadoras e o plano de adubação.
 */
export function gramasPorPlanta(kgPorHectare: number, plantasPorHa: number): number | null {
  if (plantasPorHa <= 0) return null;
  return (kgPorHectare * 1000) / plantasPorHa;
}
