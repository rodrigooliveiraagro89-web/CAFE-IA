import {
  propertyLocation,
  type FarmPlot,
  type FarmProperty,
} from "../../domain/agriculturalContext";
import { summarizeCosts, type FieldRecord } from "../../domain/fieldRecords";
import {
  interpretSoil,
  soilAlerts,
  type SoilInterpretationRow,
} from "../../domain/soilAnalysis";
import {
  calcularCalagem,
  recomendarAdubacao,
  sacasParaKgHa,
} from "../../domain/fertilization";
import {
  PRECO_PADRAO_KG,
  custoPorHectare,
  montarPrograma,
  type ProgramaItem,
} from "../../domain/fertilizerProgram";
import { buildProveniencia, type LaudoRef, type Proveniencia } from "../../domain/provenance";
import { buildManagementZones, type ManagementZone } from "../ndvi/managementZones";
import type { NdviResult } from "../ndvi/types";
import type { SoilAnalysis } from "../soil/soilStore";

/** Preferências de adubação salvas por talhão (localStorage), passadas ao relatório. */
export type FertReportPrefs = {
  vAlvo?: number;
  fonteP?: string;
  cobertura?: string;
  fonteK?: string;
  plantas?: number;
  sacas?: number;
};

export type FertReportBlock = {
  vAtual: number;
  vAlvo: number;
  calagemTHa: number;
  calagemDispensada: boolean;
  sacas: number;
  plantasPorHa: number;
  npk: { n: number; p2o5: number; k2o: number; s: number };
  itens: ProgramaItem[];
  totalKgHa: number;
  custoHa: number;
  custoSaca: number;
  kExcesso: boolean;
  proveniencia: Proveniencia;
};

function buildFertBlock(
  values: SoilAnalysis["values"],
  prefs: FertReportPrefs,
  precos: Record<string, number>,
  laudo: LaudoRef | null,
  geradoEm: string,
): FertReportBlock | null {
  const sacas = prefs.sacas ?? 45;
  const plantasPorHa = prefs.plantas ?? 4082;
  const vAlvo = prefs.vAlvo ?? 60;
  const sel = { fonteP: prefs.fonteP ?? "map", cobertura: prefs.cobertura ?? "270010", fonteK: prefs.fonteK ?? "kcl" };

  const adub = recomendarAdubacao({
    produtividadeKgHa: sacasParaKgHa(sacas),
    pResina: values.p,
    kMgPorDm3: values.k,
    sMgPorDm3: values.s,
  });
  const programa = montarPrograma({ n: adub.n, p2o5: adub.p2o5, k2o: adub.k2o }, sel);
  const custoHa = custoPorHectare(programa, precos);

  const calagem =
    values.ctc !== null && values.ctc !== undefined &&
    values.vPercent !== null && values.vPercent !== undefined
      ? calcularCalagem({ ctcCmolc: values.ctc, vAtual: values.vPercent, vAlvo })
      : null;

  return {
    vAtual: calagem?.vAtual ?? values.vPercent ?? 0,
    vAlvo,
    calagemTHa: calagem?.toneladasPorHectare ?? 0,
    calagemDispensada: calagem?.dispensada ?? false,
    sacas,
    plantasPorHa,
    npk: { n: adub.n, p2o5: adub.p2o5, k2o: adub.k2o, s: adub.s },
    itens: programa.itens,
    totalKgHa: programa.totalKgPorHectare,
    custoHa,
    custoSaca: sacas > 0 ? custoHa / sacas : 0,
    kExcesso: programa.entregue.k2o > adub.k2o * 1.3 + 1,
    proveniencia: buildProveniencia(
      laudo,
      { vAlvo, cobertura: sel.cobertura, fonteP: sel.fonteP, fonteK: sel.fonteK, sacas, plantasPorHa },
      geradoEm,
    ),
  };
}

export type PriorityLevel = "critica" | "alta" | "moderada" | "baixa" | "sem-dados";

export const priorityLabels: Record<PriorityLevel, string> = {
  critica: "Crítica",
  alta: "Alta",
  moderada: "Moderada",
  baixa: "Baixa",
  "sem-dados": "Sem dados",
};

export type PlotReportRow = {
  plot: FarmPlot;
  latestNdvi: NdviResult | null;
  ndviMean: number | null;
  ndviDate: string | null;
  costTotal: number;
  costPerHectare: number;
  costEntries: number;
  activitiesPlanned: number;
  activitiesCompleted: number;
  priority: PriorityLevel;
  zones: ManagementZone[] | null;
  soil: {
    date: string | null;
    rows: SoilInterpretationRow[];
    alerts: string[];
  } | null;
  fertilizer: FertReportBlock | null;
};

export type PropertyReport = {
  property: FarmProperty;
  generatedAt: string;
  plots: PlotReportRow[];
  executiveSummary: string;
  conclusion: string;
  ndviChart: { label: string; value: number }[];
  costByPlotChart: { label: string; value: number }[];
  costByCategoryChart: { label: string; value: number }[];
  totalCost: number;
};

function plotPriority(ndviMean: number | null): PriorityLevel {
  if (ndviMean === null) return "sem-dados";
  if (ndviMean < 0.3) return "critica";
  if (ndviMean < 0.5) return "alta";
  if (ndviMean < 0.65) return "moderada";
  return "baixa";
}

function latestNdviForPlot(history: NdviResult[], plotId: string): NdviResult | null {
  const matches = history
    .filter((result) => result.plotId === plotId)
    .sort((a, b) => new Date(b.acquiredAt).getTime() - new Date(a.acquiredAt).getTime());
  return matches[0] ?? null;
}

function latestSoilForPlot(analyses: SoilAnalysis[], plotId: string): SoilAnalysis | null {
  const matches = analyses
    .filter((item) => item.plotId === plotId)
    .sort(
      (a, b) =>
        new Date(b.analysisDate ?? b.createdAt).getTime() -
        new Date(a.analysisDate ?? a.createdAt).getTime(),
    );
  return matches[0] ?? null;
}

export function buildPropertyReport(
  property: FarmProperty,
  plots: FarmPlot[],
  records: FieldRecord[],
  ndviHistory: NdviResult[],
  soilAnalyses: SoilAnalysis[] = [],
  generatedAt: string = new Date().toISOString(),
  fertPrefsByPlot: Record<string, FertReportPrefs> = {},
  precos: Record<string, number> = PRECO_PADRAO_KG,
): PropertyReport {
  const propertyPlots = plots.filter((plot) => plot.propertyId === property.id);

  const rows: PlotReportRow[] = propertyPlots.map((plot) => {
    const plotRecords = records.filter((record) => record.plotId === plot.id);
    const costs = summarizeCosts(plotRecords);
    const latestNdvi = latestNdviForPlot(ndviHistory, plot.id);
    const ndviMean = latestNdvi?.statistics.mean ?? null;
    const latestSoil = latestSoilForPlot(soilAnalyses, plot.id);
    const soilRows = latestSoil ? interpretSoil(latestSoil.values) : [];

    return {
      plot,
      latestNdvi,
      ndviMean,
      ndviDate: latestNdvi?.acquiredAt ?? null,
      costTotal: costs.total,
      costPerHectare: plot.areaHectares > 0 ? costs.total / plot.areaHectares : 0,
      costEntries: costs.entries,
      activitiesPlanned: plotRecords.filter((record) => record.status === "planejada").length,
      activitiesCompleted: plotRecords.filter((record) => record.status === "concluida").length,
      priority: plotPriority(ndviMean),
      zones: latestNdvi ? buildManagementZones(latestNdvi) : null,
      soil: latestSoil
        ? {
            date: latestSoil.analysisDate ?? latestSoil.createdAt,
            rows: soilRows,
            alerts: soilAlerts(soilRows),
          }
        : null,
      fertilizer: latestSoil
        ? buildFertBlock(
            latestSoil.values,
            fertPrefsByPlot[plot.id] ?? {},
            precos,
            {
              id: latestSoil.id,
              data: latestSoil.analysisDate,
              laboratorio: latestSoil.laboratory,
              origem: latestSoil.source,
            },
            generatedAt,
          )
        : null,
    };
  });

  const totalCost = rows.reduce((sum, row) => sum + row.costTotal, 0);
  const byCategory = summarizeCosts(records.filter((record) => propertyPlots.some((plot) => plot.id === record.plotId)))
    .byCategory;

  return {
    property,
    generatedAt,
    plots: rows,
    executiveSummary: buildExecutiveSummary(rows),
    conclusion: buildConclusion(rows),
    ndviChart: rows
      .filter((row) => row.ndviMean !== null)
      .map((row) => ({ label: row.plot.name, value: row.ndviMean as number })),
    costByPlotChart: rows
      .filter((row) => row.costTotal > 0)
      .map((row) => ({ label: row.plot.name, value: row.costTotal })),
    costByCategoryChart: Object.entries(byCategory)
      .sort(([, left], [, right]) => right - left)
      .map(([label, value]) => ({ label, value })),
    totalCost,
  };
}

function buildExecutiveSummary(rows: PlotReportRow[]): string {
  if (rows.length === 0) {
    return "Nenhum talhão cadastrado nesta propriedade ainda.";
  }

  const withNdvi = rows.filter((row) => row.ndviMean !== null);
  if (withNdvi.length === 0) {
    return `As ${rows.length} área(s) avaliadas ainda não possuem processamento de NDVI registrado. Processe o monitoramento por satélite em cada talhão para habilitar o diagnóstico de vigor vegetativo.`;
  }

  const sorted = [...withNdvi].sort((a, b) => (a.ndviMean as number) - (b.ndviMean as number));
  const mostCritical = sorted[0];
  const mostStable = sorted[sorted.length - 1];

  const parts = [
    `As ${rows.length} área(s) avaliadas apresentam condições distintas de vigor vegetativo.`,
  ];

  if (mostCritical.priority === "critica" || mostCritical.priority === "alta") {
    parts.push(
      `O talhão ${mostCritical.plot.name} (${mostCritical.plot.crop}) é o mais limitante, com NDVI médio de ${(mostCritical.ndviMean as number).toFixed(2)} e prioridade ${priorityLabels[mostCritical.priority].toLowerCase()}.`,
    );
  }

  if (mostStable.plot.id !== mostCritical.plot.id) {
    parts.push(
      `${mostStable.plot.name} apresenta a melhor condição do conjunto, com NDVI médio de ${(mostStable.ndviMean as number).toFixed(2)}.`,
    );
  }

  return parts.join(" ");
}

function buildConclusion(rows: PlotReportRow[]): string {
  if (rows.length === 0) {
    return "Cadastre talhões nesta propriedade para gerar a conclusão do relatório.";
  }

  const critical = rows.filter((row) => row.priority === "critica" || row.priority === "alta");
  if (critical.length === 0) {
    return "Nenhum talhão está em condição crítica no momento. Manter o monitoramento periódico de NDVI e o registro de atividades no caderno de campo para acompanhar a evolução.";
  }

  const names = critical.map((row) => row.plot.name).join(", ");
  return `${critical.length === 1 ? "O talhão" : "Os talhões"} ${names} ${critical.length === 1 ? "requer" : "requerem"} atenção prioritária pelo vigor vegetativo reduzido. Recomenda-se inspeção de campo e revisão do manejo nutricional e hídrico dessas áreas.`;
}

/**
 * Resumo curto do relatório para compartilhar por WhatsApp. O consultor manda
 * ao produtor um panorama; o PDF completo vai anexado à parte.
 */
export function whatsappSummary(report: PropertyReport): string {
  const { property, plots, totalCost, generatedAt } = report;
  const location = propertyLocation(property);
  const comNdvi = plots.filter((row) => row.ndviMean !== null);
  const ndviMedio =
    comNdvi.length > 0
      ? (comNdvi.reduce((sum, row) => sum + (row.ndviMean as number), 0) / comNdvi.length).toFixed(2)
      : null;
  const data = new Date(generatedAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const brl = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const linhas = [
    "*Relatório técnico AGRYN*",
    `Propriedade: ${property.name}${location ? ` (${location})` : ""}`,
    property.producer ? `Produtor: ${property.producer}` : null,
    `Talhões avaliados: ${plots.length}`,
    ndviMedio ? `NDVI médio: ${ndviMedio}` : "NDVI: sem processamento",
    `Custo total registrado: ${brl(totalCost)}`,
    `Emitido em ${data}`,
    property.responsible ? `Responsável técnico: ${property.responsible}` : null,
    "",
    "O relatório completo em PDF segue em anexo.",
  ];
  return linhas.filter((linha): linha is string => linha !== null).join("\n");
}

/** Link wa.me com o resumo já codificado. O usuário escolhe o contato. */
export function whatsappShareUrl(report: PropertyReport): string {
  return `https://wa.me/?text=${encodeURIComponent(whatsappSummary(report))}`;
}
