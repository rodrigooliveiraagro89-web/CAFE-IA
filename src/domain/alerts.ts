import type { AppView } from "../app/navigation";
import type { FarmPlot } from "./agriculturalContext";
import type { FieldRecord } from "./fieldRecords";
import type { NdviResult } from "../features/ndvi/types";
import type { SoilAnalysis } from "../features/soil/soilStore";
import { coreAlerts, type AlertInput, type AlertSeverity, type CanonicalAlert } from "./alertRules";

/**
 * Alertas — o que torna a AGRYN proativa. A partir dos dados que já existem
 * (caderno, NDVI, análise de solo), o app aponta o que precisa de atenção em
 * vez de esperar o usuário abrir cada tela.
 *
 * A REGRA (limiares + derivação) mora em ./alertRules — a mesma que a Edge
 * Function push-alerts usa, para o que aparece na tela bater com o que chega
 * por push. Aqui só adaptamos os objetos de domínio (camelCase) para a forma
 * normalizada e traduzimos o alerta canônico para o formato do painel.
 *
 * Regra de honestidade: só geramos alertas para os quais temos dado real.
 * Janela de chuva e fase fenológica dependem de clima/fenologia estruturada e
 * ficam a cargo do painel de clima (buildWeatherAlerts), não deste módulo.
 */

export type { AlertSeverity };

export type Alert = {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  plotId?: string;
  actionLabel: string;
  actionView: AppView;
};

const SEVERIDADE_ORDEM: Record<AlertSeverity, number> = { alta: 0, media: 1, info: 2 };

function toAlert(canonical: CanonicalAlert): Alert {
  return {
    id: canonical.key,
    severity: canonical.severity,
    title: canonical.title,
    detail: canonical.body,
    plotId: canonical.plotId,
    actionLabel: canonical.actionLabel,
    actionView: canonical.view as AppView,
  };
}

export function buildAlerts(
  plots: FarmPlot[],
  records: FieldRecord[],
  ndviHistory: NdviResult[],
  soilAnalyses: SoilAnalysis[],
  today: string = new Date().toISOString().slice(0, 10),
): Alert[] {
  const input: AlertInput = {
    plots: plots.map((p) => ({ id: p.id, name: p.name })),
    records: records.map((r) => ({
      id: r.id,
      status: r.status,
      date: r.date,
      plotId: r.plotId,
      title: r.title,
      type: r.type,
    })),
    ndvi: ndviHistory.map((n) => ({
      plotId: n.plotId,
      acquiredAt: n.acquiredAt,
      mean: n.statistics?.mean ?? null,
    })),
    soil: soilAnalyses.map((s) => ({
      plotId: s.plotId,
      date: s.analysisDate ?? s.createdAt,
    })),
  };

  return coreAlerts(input, today)
    .map(toAlert)
    .sort((a, b) => SEVERIDADE_ORDEM[a.severity] - SEVERIDADE_ORDEM[b.severity]);
}
