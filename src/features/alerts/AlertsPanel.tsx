import { AlertTriangle, ArrowRight, BellRing, CheckCircle2, Info } from "lucide-react";
import type { AppView } from "../../app/navigation";
import type { Alert, AlertSeverity } from "../../domain/alerts";
import "./alerts.css";

type AlertsPanelProps = {
  alerts: Alert[];
  onNavigate: (view: AppView) => void;
  /** Quando true, mostra o cartão "tudo em dia" se não houver alertas. */
  showWhenEmpty?: boolean;
};

const SEVERITY_ICON: Record<AlertSeverity, typeof Info> = {
  alta: AlertTriangle,
  media: BellRing,
  info: Info,
};

export function AlertsPanel({ alerts, onNavigate, showWhenEmpty = true }: AlertsPanelProps) {
  if (alerts.length === 0) {
    if (!showWhenEmpty) return null;
    return (
      <section className="alerts-panel alerts-clear">
        <CheckCircle2 size={20} aria-hidden="true" />
        <div>
          <strong>Tudo em dia por aqui</strong>
          <p>Nenhuma pendência de atividade, NDVI ou análise de solo no momento.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="alerts-panel">
      <div className="alerts-title">
        <BellRing size={18} aria-hidden="true" />
        <h2>Precisa da sua atenção</h2>
        <span className="alerts-count">{alerts.length}</span>
      </div>
      <ul className="alerts-list">
        {alerts.map((alert) => {
          const Icon = SEVERITY_ICON[alert.severity];
          return (
            <li key={alert.id} className="alert-item" data-severity={alert.severity}>
              <span className="alert-icon">
                <Icon size={17} aria-hidden="true" />
              </span>
              <div className="alert-copy">
                <strong>{alert.title}</strong>
                <p>{alert.detail}</p>
              </div>
              <button
                type="button"
                className="alert-action"
                onClick={() => onNavigate(alert.actionView)}
              >
                {alert.actionLabel} <ArrowRight size={15} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
