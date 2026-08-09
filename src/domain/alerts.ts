import type { AppView } from "../app/navigation";
import type { FarmPlot } from "./agriculturalContext";
import type { FieldRecord } from "./fieldRecords";
import type { NdviResult } from "../features/ndvi/types";
import type { SoilAnalysis } from "../features/soil/soilStore";

/**
 * Alertas — o que torna a AGRYN proativa. A partir dos dados que já existem
 * (caderno, NDVI, análise de solo), o app aponta o que precisa de atenção em
 * vez de esperar o usuário abrir cada tela.
 *
 * Regra de honestidade: só geramos alertas para os quais temos dado real.
 * Janela de chuva e fase fenológica dependem de integração de clima/fenologia
 * estruturada (o clima hoje é um iframe) e ficam de fora até termos esse dado —
 * não inventamos alerta sem base.
 */

export type AlertSeverity = "alta" | "media" | "info";

export type Alert = {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  plotId?: string;
  actionLabel: string;
  actionView: AppView;
};

// Limiares nomeados (auditáveis).
const NDVI_DIAS_DESATUALIZADO = 45;
const NDVI_QUEDA_RELEVANTE = 0.08; // queda de média entre a última e a penúltima cena
const SOLO_MESES_VALIDADE = 12;
const DIAS_POR_MES = 30;

const SEVERIDADE_ORDEM: Record<AlertSeverity, number> = { alta: 0, media: 1, info: 2 };

function diasEntre(deISO: string, ateISO: string): number {
  const de = new Date(`${deISO.slice(0, 10)}T00:00:00`);
  const ate = new Date(`${ateISO.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(de.getTime()) || Number.isNaN(ate.getTime())) return 0;
  return Math.round((ate.getTime() - de.getTime()) / 86_400_000);
}

function ultimoPorData<T>(itens: T[], dataDe: (item: T) => string): T | null {
  if (!itens.length) return null;
  return [...itens].sort(
    (a, b) => new Date(dataDe(b)).getTime() - new Date(dataDe(a)).getTime(),
  )[0];
}

export function buildAlerts(
  plots: FarmPlot[],
  records: FieldRecord[],
  ndviHistory: NdviResult[],
  soilAnalyses: SoilAnalysis[],
  today: string = new Date().toISOString().slice(0, 10),
): Alert[] {
  const alerts: Alert[] = [];

  // 1) Atividades planejadas com data já vencida.
  const atrasadas = records.filter(
    (record) =>
      record.status === "planejada" &&
      record.date &&
      diasEntre(record.date, today) > 0,
  );
  if (atrasadas.length > 0) {
    alerts.push({
      id: "atividades-atrasadas",
      severity: "alta",
      title:
        atrasadas.length === 1
          ? "1 atividade atrasada"
          : `${atrasadas.length} atividades atrasadas`,
      detail: "Atividades planejadas cuja data já passou e ainda não foram concluídas.",
      actionLabel: "Abrir caderno",
      actionView: "caderno",
    });
  }

  for (const plot of plots) {
    const nomePlot = plot.name;

    // 2) NDVI em queda entre as duas últimas cenas do talhão.
    const ndviPlot = ndviHistory
      .filter((result) => result.plotId === plot.id)
      .sort((a, b) => new Date(b.acquiredAt).getTime() - new Date(a.acquiredAt).getTime());
    if (ndviPlot.length >= 2) {
      const queda = ndviPlot[1].statistics.mean - ndviPlot[0].statistics.mean;
      if (queda >= NDVI_QUEDA_RELEVANTE) {
        alerts.push({
          id: `ndvi-queda-${plot.id}`,
          severity: "alta",
          title: `Vigor em queda em ${nomePlot}`,
          detail: `NDVI médio caiu de ${ndviPlot[1].statistics.mean.toFixed(2)} para ${ndviPlot[0].statistics.mean.toFixed(2)} na última cena. Vale uma inspeção de campo.`,
          plotId: plot.id,
          actionLabel: "Ver NDVI",
          actionView: "ndvi",
        });
      }
    }

    // 3) NDVI desatualizado ou inexistente.
    const ultimoNdvi = ndviPlot[0] ?? null;
    if (!ultimoNdvi) {
      alerts.push({
        id: `ndvi-ausente-${plot.id}`,
        severity: "info",
        title: `Sem monitoramento NDVI em ${nomePlot}`,
        detail: "Processe uma cena de satélite para acompanhar o vigor da lavoura.",
        plotId: plot.id,
        actionLabel: "Processar NDVI",
        actionView: "ndvi",
      });
    } else if (diasEntre(ultimoNdvi.acquiredAt, today) > NDVI_DIAS_DESATUALIZADO) {
      alerts.push({
        id: `ndvi-desatualizado-${plot.id}`,
        severity: "media",
        title: `NDVI desatualizado em ${nomePlot}`,
        detail: `A última cena tem mais de ${NDVI_DIAS_DESATUALIZADO} dias. Atualize para acompanhar a evolução.`,
        plotId: plot.id,
        actionLabel: "Atualizar NDVI",
        actionView: "ndvi",
      });
    }

    // 4) Análise de solo ausente ou vencida.
    const solosPlot = soilAnalyses.filter((item) => item.plotId === plot.id);
    const ultimoSolo = ultimoPorData(solosPlot, (item) => item.analysisDate ?? item.createdAt);
    if (!ultimoSolo) {
      alerts.push({
        id: `solo-ausente-${plot.id}`,
        severity: "media",
        title: `Sem análise de solo em ${nomePlot}`,
        detail: "A recomendação de calagem e adubação depende do laudo do talhão.",
        plotId: plot.id,
        actionLabel: "Enviar laudo",
        actionView: "analise-solo",
      });
    } else {
      const dataSolo = ultimoSolo.analysisDate ?? ultimoSolo.createdAt;
      if (diasEntre(dataSolo, today) > SOLO_MESES_VALIDADE * DIAS_POR_MES) {
        alerts.push({
          id: `solo-vencido-${plot.id}`,
          severity: "media",
          title: `Análise de solo vencida em ${nomePlot}`,
          detail: `O último laudo tem mais de ${SOLO_MESES_VALIDADE} meses. Uma amostragem nova mantém a adubação calibrada.`,
          plotId: plot.id,
          actionLabel: "Nova análise",
          actionView: "analise-solo",
        });
      }
    }
  }

  return alerts.sort((a, b) => SEVERIDADE_ORDEM[a.severity] - SEVERIDADE_ORDEM[b.severity]);
}
