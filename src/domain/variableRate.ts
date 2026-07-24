/**
 * Prescrição a taxa variável (VR) — dose por zona de manejo.
 *
 * Combina duas coisas que já existem no AGRYN:
 *   1. As zonas A–E do NDVI (vigor relativo, com % e hectares por zona);
 *   2. A dose base de NPK do Boletim 100, calculada a partir do laudo de solo.
 *
 * Governança: a modulação por zona só faz sentido quando existe laudo. Sem
 * análise de solo não há dose — é a mesma regra já declarada em
 * `managementZones.ts` (ZONES_SOIL_NOTE).
 *
 * LIMITAÇÃO CONHECIDA: as zonas hoje são estatísticas (percentual e área por
 * faixa de NDVI), não polígonos georreferenciados. Por isso este módulo produz
 * uma TABELA de prescrição e CSV para conferência/planejamento de compra, e
 * NÃO um arquivo de mapa para a máquina aplicar sozinha. Um GeoJSON/shapefile
 * exigiria a geometria de cada zona, que o serviço de NDVI ainda não devolve.
 */

import type { ManagementZone, ZoneLetter } from "../features/ndvi/managementZones";

/**
 * Fator de modulação por zona, aplicado sobre a dose base.
 *
 * A lógica é compensatória: zonas de vigor mais baixo recebem um pouco mais,
 * zonas de vigor alto recebem um pouco menos (já estão respondendo bem). A zona
 * E fica FORA da adubação de propósito — vigor crítico normalmente tem causa
 * física (falha de plantio, compactação, drenagem, praga), e adubar sem
 * investigar só desperdiça insumo.
 */
const FATOR_POR_ZONA: Record<ZoneLetter, number> = {
  A: 0.9,
  B: 1.0,
  C: 1.15,
  D: 1.25,
  E: 0,
};

export const ZONA_EXCLUIDA_NOTA =
  "A zona E fica fora da adubação até a causa do vigor crítico ser investigada em campo. Vigor crítico raramente é só nutrição — adubar antes de saber a causa desperdiça insumo.";

export const VR_LIMITACAO_GEO =
  "As zonas são estatísticas (área e percentual por faixa de NDVI), não polígonos georreferenciados. Esta prescrição serve para planejar dose e compra; ela ainda não substitui um mapa de aplicação para a máquina operar sozinha.";

export type NutrienteDose = {
  n: number;
  p2o5: number;
  k2o: number;
};

export type ZonaPrescricao = {
  letter: ZoneLetter;
  label: string;
  color: string;
  percentage: number;
  hectares: number;
  fator: number;
  /** Dose por hectare nesta zona (kg/ha). */
  dosePorHectare: NutrienteDose;
  /** Total de nutriente para a área da zona (kg). */
  totalZona: NutrienteDose;
  excluida: boolean;
};

export type PrescricaoVR = {
  zonas: ZonaPrescricao[];
  /** Soma dos totais por zona (kg). */
  totalVariavel: NutrienteDose;
  /** O que seria aplicado com dose única na área toda (kg). */
  totalUniforme: NutrienteDose;
  /** Diferença (uniforme − variável): positivo = economia de insumo. */
  economia: NutrienteDose;
  hectaresTotais: number;
  hectaresAdubados: number;
};

function multiplicar(dose: NutrienteDose, fator: number): NutrienteDose {
  return {
    n: dose.n * fator,
    p2o5: dose.p2o5 * fator,
    k2o: dose.k2o * fator,
  };
}

function somar(a: NutrienteDose, b: NutrienteDose): NutrienteDose {
  return { n: a.n + b.n, p2o5: a.p2o5 + b.p2o5, k2o: a.k2o + b.k2o };
}

const ZERO: NutrienteDose = { n: 0, p2o5: 0, k2o: 0 };

export function construirPrescricaoVR(
  zonas: ManagementZone[],
  doseBase: NutrienteDose,
): PrescricaoVR {
  const zonasPrescricao: ZonaPrescricao[] = zonas.map((zona) => {
    const fator = FATOR_POR_ZONA[zona.letter];
    const dosePorHectare = multiplicar(doseBase, fator);
    return {
      letter: zona.letter,
      label: zona.label,
      color: zona.color,
      percentage: zona.percentage,
      hectares: zona.hectares,
      fator,
      dosePorHectare,
      totalZona: multiplicar(dosePorHectare, zona.hectares),
      excluida: fator === 0,
    };
  });

  const totalVariavel = zonasPrescricao.reduce(
    (acumulado, zona) => somar(acumulado, zona.totalZona),
    ZERO,
  );
  const hectaresTotais = zonas.reduce((soma, zona) => soma + zona.hectares, 0);
  const hectaresAdubados = zonasPrescricao
    .filter((zona) => !zona.excluida)
    .reduce((soma, zona) => soma + zona.hectares, 0);

  const totalUniforme = multiplicar(doseBase, hectaresTotais);

  return {
    zonas: zonasPrescricao,
    totalVariavel,
    totalUniforme,
    economia: {
      n: totalUniforme.n - totalVariavel.n,
      p2o5: totalUniforme.p2o5 - totalVariavel.p2o5,
      k2o: totalUniforme.k2o - totalVariavel.k2o,
    },
    hectaresTotais,
    hectaresAdubados,
  };
}

const CSV_CABECALHO = [
  "zona",
  "classe",
  "area_ha",
  "percentual",
  "fator",
  "N_kg_ha",
  "P2O5_kg_ha",
  "K2O_kg_ha",
  "N_total_kg",
  "P2O5_total_kg",
  "K2O_total_kg",
];

const dec = (value: number, digits = 2) => value.toFixed(digits);

/**
 * CSV para conferência e para alimentar a adubadora de taxa variável por zona.
 * Usa ponto como separador decimal e vírgula como separador de campo, que é o
 * formato aceito pela maioria dos controladores.
 */
export function prescricaoParaCsv(prescricao: PrescricaoVR): string {
  const linhas = prescricao.zonas.map((zona) =>
    [
      zona.letter,
      zona.label,
      dec(zona.hectares),
      dec(zona.percentage, 1),
      dec(zona.fator, 2),
      dec(zona.dosePorHectare.n, 1),
      dec(zona.dosePorHectare.p2o5, 1),
      dec(zona.dosePorHectare.k2o, 1),
      dec(zona.totalZona.n, 1),
      dec(zona.totalZona.p2o5, 1),
      dec(zona.totalZona.k2o, 1),
    ].join(","),
  );

  return [CSV_CABECALHO.join(","), ...linhas].join("\n");
}
