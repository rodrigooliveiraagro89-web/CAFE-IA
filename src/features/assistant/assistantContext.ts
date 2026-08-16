import type { FarmPlot, FarmProperty } from "../../domain/agriculturalContext";
import {
  calcularCalagem,
  recomendarAdubacao,
  sacasParaKgHa,
} from "../../domain/fertilization";
import { interpretSoil, soilLevelLabel } from "../../domain/soilAnalysis";
import type { SoilAnalysis } from "../soil/soilStore";

/**
 * Monta o "briefing" do talhão selecionado para o assistente responder com os
 * NÚMEROS REAIS da lavoura (laudo, calagem/NPK do Boletim 100, NDVI, alertas),
 * em vez de responder de forma genérica. Tudo aqui vem dos módulos
 * determinísticos do app — não é número inventado; o assistente pode citar.
 */

export type AssistantContextInput = {
  property: FarmProperty | null;
  plot: FarmPlot | null;
  soil: SoilAnalysis | null;
  ndviMean: number | null;
  ndviDate: string | null;
  alerts: string[];
};

function dataBR(iso: string | null): string {
  if (!iso) return "sem data";
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? "sem data" : d.toLocaleDateString("pt-BR");
}

export function buildAssistantContext(input: AssistantContextInput): string {
  const { property, plot, soil } = input;
  if (!plot) return "";

  const linhas: string[] = [];
  linhas.push(
    `Talhão selecionado: ${plot.name}${property ? ` (propriedade ${property.name}` + (property.city ? `, ${property.city}-${property.state}` : "") + ")" : ""}.`,
  );
  linhas.push(
    `Cultura: ${plot.crop}${plot.variety ? `, ${plot.variety}` : ""}. Safra ${plot.season || "não informada"}. ` +
      `Área ${plot.areaHectares} ha. Fenologia: ${plot.phenologicalStage || "não informada"}.`,
  );

  if (soil) {
    const rows = interpretSoil(soil.values).filter((r) => r.value !== null && r.value !== undefined);
    if (rows.length > 0) {
      const resumo = rows
        .map((r) => `${r.label} ${r.value} (${soilLevelLabel(r.level)})`)
        .join("; ");
      linhas.push(`Último laudo (${dataBR(soil.analysisDate)}): ${resumo}.`);
    }
    if (soil.values.ctc != null && soil.values.vPercent != null) {
      const cal = calcularCalagem({ ctcCmolc: soil.values.ctc, vAtual: soil.values.vPercent, vAlvo: 60 });
      linhas.push(
        cal.dispensada
          ? "Calagem: dispensada (V% já atingiu 60%)."
          : `Calagem (alvo V% 60): ${cal.toneladasPorHectare.toFixed(1)} t/ha de calcário dolomítico.`,
      );
    }
    const adub = recomendarAdubacao({
      produtividadeKgHa: sacasParaKgHa(45),
      pResina: soil.values.p,
      kMgPorDm3: soil.values.k,
      sMgPorDm3: soil.values.s,
    });
    linhas.push(
      `Adubação Boletim 100 (cenário médio 45 sc/ha): N ${adub.n}, P2O5 ${adub.p2o5}, K2O ${adub.k2o}, S ${adub.s} kg/ha.`,
    );
  } else {
    linhas.push("Sem laudo de solo cadastrado neste talhão.");
  }

  if (input.ndviMean != null) {
    linhas.push(`NDVI médio mais recente: ${input.ndviMean.toFixed(2)} (${dataBR(input.ndviDate)}).`);
  }
  if (input.alerts.length > 0) {
    linhas.push(`Alertas ativos: ${input.alerts.join("; ")}.`);
  }

  return linhas.join("\n");
}
