import { useMemo } from "react";
import {
  ArrowRight,
  Camera,
  CircleDollarSign,
  FlaskConical,
  Leaf,
  Satellite,
  Sprout,
  Wheat,
  type LucideIcon,
} from "lucide-react";
import type { AppView } from "../../app/navigation";
import type { FieldRecord } from "../../domain/fieldRecords";
import {
  buildTimeline,
  summarizeTimeline,
  type TimelineKind,
} from "../../domain/timeline";
import type { AgriculturalController } from "../../lib/useAgriculturalContext";
import type { NdviResult } from "../ndvi/types";
import type { SoilAnalysis } from "../soil/soilStore";
import "./timeline.css";

type TimelineModuleProps = {
  agriculture: AgriculturalController;
  records: FieldRecord[];
  ndviHistory: NdviResult[];
  soilAnalyses: SoilAnalysis[];
  onNavigate: (view: AppView) => void;
};

const KIND_META: Record<TimelineKind, { label: string; icon: LucideIcon; color: string }> = {
  manejo: { label: "Manejo", icon: Sprout, color: "#059669" },
  custo: { label: "Custo", icon: CircleDollarSign, color: "#d97706" },
  colheita: { label: "Colheita", icon: Wheat, color: "#ca8a04" },
  foto: { label: "Foto/doc", icon: Camera, color: "#7c3aed" },
  solo: { label: "Solo", icon: FlaskConical, color: "#0f766e" },
  ndvi: { label: "NDVI", icon: Satellite, color: "#2563eb" },
};

const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : iso;
}

export function TimelineModule({
  agriculture,
  records,
  ndviHistory,
  soilAnalyses,
  onNavigate,
}: TimelineModuleProps) {
  const plot = agriculture.selectedPlot;

  const events = useMemo(
    () => (plot ? buildTimeline(plot.id, records, ndviHistory, soilAnalyses) : []),
    [plot, records, ndviHistory, soilAnalyses],
  );
  const summary = useMemo(
    () => (plot ? summarizeTimeline(events, records, plot.id) : null),
    [events, plot, records],
  );

  if (!plot) {
    return (
      <div className="page-stack platform-page">
        <header className="page-header">
          <div>
            <span className="eyebrow">Rastreabilidade</span>
            <h1>Linha do tempo</h1>
          </div>
        </header>
        <section className="empty-state context-empty">
          <Leaf size={31} />
          <h2>Selecione um talhão</h2>
          <p>A linha do tempo reúne toda a história de um talhão específico.</p>
          <button type="button" onClick={() => onNavigate("propriedades")}>
            Selecionar talhão
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack platform-page">
      <header className="page-header context-page-header">
        <div>
          <span className="eyebrow">Rastreabilidade · {plot.name}</span>
          <h1>Linha do tempo</h1>
          <p>Tudo que aconteceu neste talhão — manejos, custos, análises e satélite — num fio só.</p>
        </div>
        <button className="secondary-button" type="button" onClick={() => onNavigate("caderno")}>
          Registrar atividade <ArrowRight size={17} />
        </button>
      </header>

      {summary && summary.total > 0 && (
        <section className="timeline-summary">
          <article>
            <span>Eventos</span>
            <strong>{summary.total}</strong>
          </article>
          <article>
            <span>Custo acumulado</span>
            <strong>{summary.custoTotal > 0 ? brl(summary.custoTotal) : "—"}</strong>
          </article>
          <article>
            <span>Período</span>
            <strong>
              {summary.primeiraData ? formatarData(summary.primeiraData) : "—"}
              {summary.ultimaData && summary.ultimaData !== summary.primeiraData
                ? ` → ${formatarData(summary.ultimaData)}`
                : ""}
            </strong>
          </article>
        </section>
      )}

      {events.length === 0 ? (
        <section className="empty-state context-empty">
          <Sprout size={31} />
          <h2>Ainda sem histórico</h2>
          <p>
            Registre atividades no caderno, envie um laudo de solo ou processe o NDVI — tudo
            aparece aqui automaticamente.
          </p>
          <button type="button" onClick={() => onNavigate("caderno")}>
            Abrir caderno de campo
          </button>
        </section>
      ) : (
        <section className="panel-card">
          <ol className="timeline">
            {events.map((event) => {
              const meta = KIND_META[event.kind];
              const Icon = meta.icon;
              return (
                <li key={event.id} className="timeline-event">
                  <span className="timeline-dot" style={{ background: meta.color }}>
                    <Icon size={15} aria-hidden="true" />
                  </span>
                  <div className="timeline-body">
                    <div className="timeline-head">
                      <strong>{event.title}</strong>
                      <span className="timeline-badge" style={{ color: meta.color }}>
                        {meta.label}
                      </span>
                      <time>{formatarData(event.date)}</time>
                    </div>
                    {event.detail && <p>{event.detail}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}
