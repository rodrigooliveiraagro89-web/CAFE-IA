import type { FarmPlot, FarmProperty } from "../../domain/agriculturalContext";
import { recomendarNutrientes5a } from "../../domain/coffeeFertility5a";
import { CENARIOS, type CenarioId } from "../../domain/fertilization";
import { interpretSoil, soilLevelLabel } from "../../domain/soilAnalysis";
import { analysisToSolo, subFromValues } from "../fertilization/soilToSolo";
import type { SoilAnalysis } from "../soil/soilStore";

/**
 * Monta o "briefing" do talhão selecionado para o assistente responder com os
 * NÚMEROS REAIS da lavoura (laudo, calagem/NPK pela 5ª Aproximação MG, NDVI,
 * alertas), em vez de responder de forma genérica. Tudo aqui vem dos módulos
 * determinísticos do app — não é número inventado; o assistente pode citar.
 *
 * Fonte única de dose: usa o MESMO motor (recomendarNutrientes5a) e o MESMO
 * cenário de produção salvo por talhão que a tela de adubação — para o chat
 * nunca contradizer o painel.
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

// Cenário de produção salvo por talhão (mesma chave da tela de adubação).
function cenarioDoTalhao(plotId: string): CenarioId {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(`agryn.fert5a.${plotId}`);
      if (raw === "baixa" || raw === "media" || raw === "alta") return raw;
    }
  } catch {
    // sem persistência disponível
  }
  return "media";
}

function fmtDose(x: number | null): string {
  return x === null ? "—" : String(Math.round(x));
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

    const cenario = cenarioDoTalhao(plot.id);
    const sacas = CENARIOS.find((c) => c.id === cenario)?.sacasPorHectare ?? 45;
    const rec = recomendarNutrientes5a({
      lavoura: { fase: "producao", produtividade_esperada_sc_ha: sacas, PRNT_percentual: 95 },
      solo: analysisToSolo(soil.values),
      sub: subFromValues(soil.values),
    });
    const cs = rec.correcao_solo;
    linhas.push(
      cs.calagem_t_ha_produto !== null && cs.calagem_t_ha_produto > 0.1
        ? `Calagem: ${cs.calagem_t_ha_produto.toFixed(2)} t/ha${cs.corretivo_sugerido ? ` (${cs.corretivo_sugerido})` : ""}.`
        : "Calagem: dispensada pelos dados atuais (V% no alvo).",
    );
    if (cs.gessagem_indicada && cs.gesso_t_ha !== null) {
      linhas.push(`Gessagem: indicada, ${cs.gesso_t_ha.toFixed(2)} t/ha de gesso.`);
    }
    const n = rec.necessidade_nutrientes;
    linhas.push(
      `Adubação 5ª Aproximação MG (${sacas} sc/ha): N ${fmtDose(n.N_kg_ha_ano)}, ` +
        `P2O5 ${fmtDose(n.P2O5_kg_ha_ano)}, K2O ${fmtDose(n.K2O_kg_ha_ano)}, S ${fmtDose(n.S_kg_ha_ano)} kg/ha.`,
    );
    if (n.P2O5_kg_ha_ano === null) {
      linhas.push("Observação: P2O5 não calculado — falta P-rem ou teor de argila no laudo.");
    }
    if (n.K2O_kg_ha_ano === null) {
      linhas.push("Observação: K2O não calculado — falta o teor de K (mg/dm³) no laudo.");
    }
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
