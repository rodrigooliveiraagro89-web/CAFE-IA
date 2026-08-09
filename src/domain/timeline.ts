import type { FieldRecord } from "./fieldRecords";
import type { NdviResult } from "../features/ndvi/types";
import type { SoilAnalysis } from "../features/soil/soilStore";

/**
 * Linha do tempo da safra — reúne num fio único, por talhão, tudo que aconteceu:
 * manejos, custos, fotos, análises de solo e cenas de NDVI. É o que dá
 * rastreabilidade: a história completa do talhão, ordenada no tempo.
 *
 * Função pura: recebe os dados que já existem e devolve os eventos ordenados.
 */

export type TimelineKind = "manejo" | "custo" | "colheita" | "foto" | "solo" | "ndvi";

export type TimelineEvent = {
  id: string;
  date: string; // YYYY-MM-DD
  kind: TimelineKind;
  title: string;
  detail: string;
};

const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function recordKind(record: FieldRecord): TimelineKind {
  const type = record.type.toLowerCase();
  if (type.includes("colheita")) return "colheita";
  if (record.attachments.length > 0 && (type.includes("foto") || type.includes("documento")))
    return "foto";
  if (record.cost > 0 && type.includes("custo")) return "custo";
  return "manejo";
}

function recordDetail(record: FieldRecord): string {
  const partes: string[] = [];
  if (record.quantity && record.unit) partes.push(`${record.quantity} ${record.unit}`);
  else if (record.quantity) partes.push(record.quantity);
  if (record.cost > 0) partes.push(brl(record.cost));
  if (record.attachments.length > 0) {
    partes.push(
      record.attachments.length === 1
        ? "1 anexo"
        : `${record.attachments.length} anexos`,
    );
  }
  if (record.notes) partes.push(record.notes);
  partes.push(record.status === "concluida" ? "concluída" : "planejada");
  return partes.join(" · ");
}

export function buildTimeline(
  plotId: string,
  records: FieldRecord[],
  ndviHistory: NdviResult[],
  soilAnalyses: SoilAnalysis[],
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const record of records) {
    if (record.plotId !== plotId || !record.date) continue;
    events.push({
      id: `rec-${record.id}`,
      date: record.date.slice(0, 10),
      kind: recordKind(record),
      title: record.title || record.type,
      detail: recordDetail(record),
    });
  }

  for (const soil of soilAnalyses) {
    if (soil.plotId !== plotId) continue;
    const date = (soil.analysisDate ?? soil.createdAt).slice(0, 10);
    const detalhe: string[] = [];
    if (soil.laboratory) detalhe.push(soil.laboratory);
    if (soil.values.ph != null) detalhe.push(`pH ${soil.values.ph}`);
    if (soil.values.vPercent != null) detalhe.push(`V% ${soil.values.vPercent}`);
    detalhe.push(soil.source);
    events.push({
      id: `soil-${soil.id}`,
      date,
      kind: "solo",
      title: "Análise de solo",
      detail: detalhe.join(" · "),
    });
  }

  for (const ndvi of ndviHistory) {
    if (ndvi.plotId !== plotId) continue;
    events.push({
      id: `ndvi-${ndvi.id}`,
      date: ndvi.acquiredAt.slice(0, 10),
      kind: "ndvi",
      title: "Cena NDVI processada",
      detail: `Vigor médio ${ndvi.statistics.mean.toFixed(2)}`,
    });
  }

  // Mais recente primeiro; desempata por tipo para estabilidade.
  return events.sort((a, b) => {
    const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
    return diff !== 0 ? diff : a.id.localeCompare(b.id);
  });
}

export type TimelineSummary = {
  total: number;
  porTipo: Record<TimelineKind, number>;
  custoTotal: number;
  primeiraData: string | null;
  ultimaData: string | null;
};

export function summarizeTimeline(
  events: TimelineEvent[],
  records: FieldRecord[],
  plotId: string,
): TimelineSummary {
  const porTipo = { manejo: 0, custo: 0, colheita: 0, foto: 0, solo: 0, ndvi: 0 } as Record<
    TimelineKind,
    number
  >;
  for (const event of events) porTipo[event.kind] += 1;

  const custoTotal = records
    .filter((record) => record.plotId === plotId && record.cost > 0)
    .reduce((soma, record) => soma + record.cost, 0);

  const datas = events.map((event) => event.date).sort();
  return {
    total: events.length,
    porTipo,
    custoTotal,
    primeiraData: datas[0] ?? null,
    ultimaData: datas[datas.length - 1] ?? null,
  };
}
