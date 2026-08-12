/**
 * Proveniência da recomendação de adubação — rastreabilidade para o RT.
 *
 * Toda dose sugerida é determinística e nasce de três coisas: (1) um laudo de
 * solo específico, (2) uma base técnica versionada (Boletim 100/IAC + o
 * algoritmo do AGRYN) e (3) os parâmetros escolhidos (V% alvo, fórmula,
 * produtividade, população). Registrar isso permite ao agrônomo que assina
 * provar, meses depois, em que dado e em que critério a recomendação se apoiou.
 */

/** Nome e versão da base determinística. Suba a versão ao mudar tabelas/regras. */
export const ENGINE_NOME = "AGRYN — Boletim 100 (IAC)";
export const ENGINE_VERSAO = "b100.2026-08";

export type LaudoOrigem = "foto" | "pdf" | "manual";

export type LaudoRef = {
  id: string;
  data: string | null; // data da análise (analysisDate)
  laboratorio: string | null;
  origem: LaudoOrigem;
};

export type RecomendacaoParametros = {
  vAlvo: number;
  cobertura: string; // código da fórmula de cobertura, ex.: "27-00-10"
  fonteP?: string;
  fonteK?: string;
  sacas: number; // produtividade esperada (sc/ha)
  plantasPorHa: number;
};

export type Proveniencia = {
  engine: string;
  versao: string;
  geradoEm: string; // ISO
  laudo: LaudoRef | null;
  parametros: RecomendacaoParametros;
};

export function buildProveniencia(
  laudo: LaudoRef | null,
  parametros: RecomendacaoParametros,
  geradoEm: string = new Date().toISOString(),
): Proveniencia {
  return { engine: ENGINE_NOME, versao: ENGINE_VERSAO, geradoEm, laudo, parametros };
}

const ORIGEM_LABEL: Record<LaudoOrigem, string> = {
  foto: "foto do laudo",
  pdf: "PDF do laudo",
  manual: "digitação manual",
};

function dataBR(iso: string | null): string {
  if (!iso) return "sem data";
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? "sem data" : d.toLocaleDateString("pt-BR");
}

/** Frase única de proveniência para o rodapé do parecer/PDF. */
export function provenienciaResumo(p: Proveniencia): string {
  const base = `${p.engine} v${p.versao}, gerado em ${dataBR(p.geradoEm)}`;
  const laudo = p.laudo
    ? `laudo ${p.laudo.laboratorio ? p.laudo.laboratorio + " " : ""}${dataBR(p.laudo.data)} (${ORIGEM_LABEL[p.laudo.origem]})`
    : "sem laudo (classes médias assumidas)";
  const par = `V% alvo ${p.parametros.vAlvo}, cobertura ${p.parametros.cobertura}, ${p.parametros.sacas} sc/ha, ${p.parametros.plantasPorHa} pl/ha`;
  return `Base: ${base}. Origem: ${laudo}. Parâmetros: ${par}.`;
}

export { ORIGEM_LABEL as origemLabel, dataBR as provenienciaDataBR };
