/**
 * Referências e cálculos de morango — Sul de Minas (900–1.400 m, cultivo
 * protegido, fertirrigação por gotejamento).
 *
 * Escopo honesto: aqui ficam apenas os dados que são referência agronômica
 * sólida — o catálogo de cultivares e as metas de produtividade — e a
 * aritmética de rentabilidade. NÃO há tabela de lâmina de irrigação (mm) por
 * fase: isso depende de substrato, clima e estágio, e sem um número
 * referenciado seria chute. A orientação de irrigação fica qualitativa.
 */

export type FotoperiodoTipo = "dia-neutro" | "dia-curto";

export type Cultivar = {
  nome: string;
  tipo: FotoperiodoTipo;
  nota: string;
};

/**
 * Cultivares usadas na região. O tipo de fotoperíodo define o manejo: as de
 * dia-neutro produzem de forma mais contínua ao longo do ano; as de dia-curto
 * concentram a produção conforme o comprimento do dia.
 */
export const CULTIVARES: Cultivar[] = [
  { nome: "Albion", tipo: "dia-neutro", nota: "Firmeza e Brix altos; boa para mesa e transporte." },
  { nome: "San Andreas", tipo: "dia-neutro", nota: "Produção contínua e boa sanidade de folha." },
  { nome: "Monterey", tipo: "dia-neutro", nota: "Fruto grande e produtivo; sabor doce." },
  { nome: "Cabrillo", tipo: "dia-neutro", nota: "Alto potencial produtivo e fruta uniforme." },
  { nome: "Festival", tipo: "dia-curto", nota: "Tradicional; boa firmeza e cor." },
  { nome: "Pircinque", tipo: "dia-curto", nota: "Fruta firme de boa aparência comercial." },
  { nome: "Sabrina", tipo: "dia-curto", nota: "Precoce, fruta grande e vistosa." },
  { nome: "Murano", tipo: "dia-neutro", nota: "Rústica, produção estável em cultivo protegido." },
  { nome: "Aromas", tipo: "dia-neutro", nota: "Boa conservação pós-colheita." },
];

export function acharCultivar(nome: string): Cultivar | null {
  const alvo = nome.trim().toLowerCase();
  return CULTIVARES.find((item) => item.nome.toLowerCase() === alvo) ?? null;
}

/** Detecta se um talhão é de morango pelo texto da cultura. */
export function ehMorango(cultura: string): boolean {
  return /morango|strawberry/i.test(cultura);
}

// --- Fases fenológicas (qualitativas) -------------------------------------

export type FaseMorango = {
  id: string;
  nome: string;
  foco: string;
};

export const FASES: FaseMorango[] = [
  { id: "plantio", nome: "Plantio e pegamento", foco: "Enraizamento das mudas; irrigação frequente e leve, sem encharcar." },
  { id: "vegetativo", nome: "Crescimento vegetativo", foco: "Formação de folhas e coroa; nitrogênio e monitoramento de ácaro/tripes." },
  { id: "floracao", nome: "Floração e frutificação", foco: "Cálcio e boro para firmeza e pegamento; atenção a Botrytis." },
  { id: "colheita", nome: "Colheita", foco: "Potássio para Brix; colheita frequente e cadeia de frio." },
  { id: "renovacao", nome: "Renovação / fim de ciclo", foco: "Planejar próximo plantio e a origem das mudas." },
];

// --- Produtividade e rentabilidade ----------------------------------------

/** Metas de produtividade (t/ha) usadas como cenários no dashboard. */
export const METAS_PRODUTIVIDADE = [60, 80, 100, 120] as const;

export type RentabilidadeInput = {
  /** Produtividade esperada, em toneladas por hectare. */
  toneladasPorHectare: number;
  /** Preço recebido, em R$/kg. */
  precoPorKg: number;
  /** Custo acumulado, em R$/hectare. */
  custoPorHectare: number;
};

export type RentabilidadeResult = {
  receitaPorHectare: number;
  custoPorHectare: number;
  margemPorHectare: number;
  /** Retorno sobre o custo, em % (margem / custo × 100). Null sem custo. */
  retornoPercentual: number | null;
};

export function calcularRentabilidade(input: RentabilidadeInput): RentabilidadeResult {
  const { toneladasPorHectare, precoPorKg, custoPorHectare } = input;
  const receitaPorHectare = toneladasPorHectare * 1000 * precoPorKg;
  const margemPorHectare = receitaPorHectare - custoPorHectare;

  return {
    receitaPorHectare,
    custoPorHectare,
    margemPorHectare,
    retornoPercentual: custoPorHectare > 0 ? (margemPorHectare / custoPorHectare) * 100 : null,
  };
}
