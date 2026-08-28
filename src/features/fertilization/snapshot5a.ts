import type { Recomendacao5a, FormulacaoPlano, Fase } from "../../domain/coffeeFertility5a";
import type { RecommendationSnapshot, SnapshotItem } from "../../domain/recommendationSnapshot";

/**
 * Monta o snapshot IMUTÁVEL a partir da recomendação da 5ª Aproximação — a ponte
 * entre o motor determinístico e a rastreabilidade (recommendation_snapshots).
 * Congela o laudo de origem, a base/versão/catálogo, os parâmetros escolhidos, o
 * NPK, a calagem e o programa de fórmulas. O preço fica fora de propósito (o app
 * não exibe preço), então custoHa/custoSaca vão zerados.
 */
export function buildSnapshot5a(opts: {
  plotId: string;
  soilAnalysisId: string | null;
  rec: Recomendacao5a;
  formulacao: FormulacaoPlano;
  vAlvo: number;
  sacas: number;
  plantasPorHa: number;
  fase: Fase;
}): RecommendationSnapshot {
  const { plotId, soilAnalysisId, rec, formulacao, vAlvo, sacas, plantasPorHa, fase } = opts;
  const n = rec.necessidade_nutrientes;

  const programa: SnapshotItem[] = [];
  if (formulacao.principal) {
    programa.push({
      id: formulacao.principal.formula,
      formula: formulacao.principal.formula,
      kgPorHectare: Math.round(formulacao.principal.kg_ha),
    });
  }
  for (const item of formulacao.complementos) {
    programa.push({ id: item.produto, formula: item.formula, kgPorHectare: Math.round(item.kg_ha) });
  }

  return {
    plotId,
    soilAnalysisId,
    engine: rec.regra.fonte,
    version: rec.regra.versao,
    params: {
      vAlvo,
      cobertura: formulacao.principal?.formula ?? "",
      sacas,
      plantasPorHa,
      fase,
      catalogo: rec.regra.catalogo,
    },
    npk: {
      n: n.N_kg_ha_ano ?? 0,
      p2o5: n.P2O5_kg_ha_ano ?? 0,
      k2o: n.K2O_kg_ha_ano ?? 0,
      s: n.S_kg_ha_ano ?? 0,
    },
    calagemTHa: rec.correcao_solo.calagem_t_ha_produto ?? 0,
    programa,
    custoHa: 0,
    custoSaca: 0,
  };
}
