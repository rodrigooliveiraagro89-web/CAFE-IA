import type { FarmPlot, FarmProperty } from "../../domain/agriculturalContext";
import { summarizeCosts, type FieldRecord } from "../../domain/fieldRecords";
import { buildManagementZones, type ManagementZone } from "../ndvi/managementZones";
import type { NdviResult } from "../ndvi/types";

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

export function buildPropertyReport(
  property: FarmProperty,
  plots: FarmPlot[],
  records: FieldRecord[],
  ndviHistory: NdviResult[],
  generatedAt: string = new Date().toISOString(),
): PropertyReport {
  const propertyPlots = plots.filter((plot) => plot.propertyId === property.id);

  const rows: PlotReportRow[] = propertyPlots.map((plot) => {
    const plotRecords = records.filter((record) => record.plotId === plot.id);
    const costs = summarizeCosts(plotRecords);
    const latestNdvi = latestNdviForPlot(ndviHistory, plot.id);
    const ndviMean = latestNdvi?.statistics.mean ?? null;

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
