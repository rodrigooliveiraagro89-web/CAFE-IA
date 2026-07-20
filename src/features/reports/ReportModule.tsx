import { Crown, Download, MapPinned } from "lucide-react";
import { useMemo, useState } from "react";
import type { AppView } from "../../app/navigation";
import { propertyLocation } from "../../domain/agriculturalContext";
import type { FieldRecord } from "../../domain/fieldRecords";
import { resolvePlan, TRIAL_DAYS, type PlanId } from "../../domain/plans";
import type { AgriculturalController } from "../../lib/useAgriculturalContext";
import type { NdviResult } from "../ndvi/types";
import { buildPropertyReport, priorityLabels, type PropertyReport } from "./buildReport";
import { BarChart } from "./charts/BarChart";
import "./report.css";

type ReportModuleProps = {
  agriculture: AgriculturalController;
  records: FieldRecord[];
  ndviHistory: NdviResult[];
  planId: PlanId;
  trialAvailable: boolean;
  onStartTrial?: () => void;
  onNavigate: (view: AppView) => void;
};

function UpgradeNotice({
  trialAvailable,
  onStartTrial,
}: {
  trialAvailable: boolean;
  onStartTrial?: () => void;
}) {
  return (
    <div className="upgrade-notice" role="status">
      <Crown size={20} aria-hidden="true" />
      <div>
        <strong>Relatório disponível no plano Pro</strong>
        <p>
          Gere um relatório técnico consolidado (NDVI, custos e caderno de campo) por propriedade,
          pronto para entregar ao produtor.
        </p>
      </div>
      {trialAvailable && onStartTrial && (
        <button className="primary-button" type="button" onClick={onStartTrial}>
          Testar o Pro grátis por {TRIAL_DAYS} dias
        </button>
      )}
      <a className="primary-button" href="https://www.asaas.com/c/fw5jokq1e8cfdink" target="_blank" rel="noreferrer">
        Assinar o Pro — R$ 49,90/mês
      </a>
      <a className="secondary-button" href="./landing.html#planos" target="_blank" rel="noreferrer">
        Ver planos
      </a>
    </div>
  );
}

export function ReportModule({
  agriculture,
  records,
  ndviHistory,
  planId,
  trialAvailable,
  onStartTrial,
  onNavigate,
}: ReportModuleProps) {
  const { state } = agriculture;
  const [selectedPropertyId, setSelectedPropertyId] = useState(
    agriculture.selectedProperty?.id ?? state.properties[0]?.id ?? "",
  );
  const property =
    state.properties.find((candidate) => candidate.id === selectedPropertyId) ??
    state.properties[0] ??
    null;
  const plan = resolvePlan(planId);
  const isPro = plan.id === "pro";

  const report = useMemo<PropertyReport | null>(() => {
    if (!property) return null;
    return buildPropertyReport(property, state.plots, records, ndviHistory);
  }, [property, state.plots, records, ndviHistory]);

  return (
    <div className="page-stack platform-page">
      <header className="page-header context-page-header no-print">
        <div>
          <span className="eyebrow">Documentos técnicos</span>
          <h1>Relatórios</h1>
          <p>
            Consolide NDVI, custos e caderno de campo em um relatório por propriedade, pronto para
            entregar ao produtor.
          </p>
        </div>
        {state.properties.length > 0 && (
          <label className="report-property-select">
            Propriedade
            <select
              value={property?.id ?? ""}
              onChange={(event) => setSelectedPropertyId(event.target.value)}
            >
              {state.properties.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>

      {state.properties.length === 0 ? (
        <section className="empty-state context-empty">
          <MapPinned size={31} />
          <h2>Cadastre uma propriedade</h2>
          <p>O relatório é gerado a partir das propriedades e talhões cadastrados na conta.</p>
          <button type="button" onClick={() => onNavigate("propriedades")}>
            Cadastrar propriedade
          </button>
        </section>
      ) : !isPro ? (
        <UpgradeNotice trialAvailable={trialAvailable} onStartTrial={onStartTrial} />
      ) : report ? (
        <>
          <div className="no-print report-actions">
            <button className="primary-button" type="button" onClick={() => window.print()}>
              <Download size={16} aria-hidden="true" /> Baixar PDF
            </button>
          </div>
          <ReportDocument report={report} />
        </>
      ) : null}
    </div>
  );
}

function ReportDocument({ report }: { report: PropertyReport }) {
  const { property, plots, executiveSummary, conclusion, ndviChart, costByPlotChart, costByCategoryChart, totalCost, generatedAt } =
    report;
  const location = propertyLocation(property);

  return (
    <article className="report-print-area">
      <header className="report-doc-header">
        <h1>Relatório Técnico da Propriedade</h1>
        <p className="report-doc-subtitle">
          {property.name}
          {location ? ` — ${location}` : ""}
        </p>
      </header>

      <table className="report-info-table">
        <tbody>
          <tr>
            <th>Produtor</th>
            <td>{property.producer || "—"}</td>
          </tr>
          <tr>
            <th>Responsável técnico</th>
            <td>{property.responsible || "—"}</td>
          </tr>
          <tr>
            <th>Talhões avaliados</th>
            <td>{plots.length > 0 ? plots.map((row) => row.plot.name).join("; ") : "Nenhum talhão cadastrado"}</td>
          </tr>
          <tr>
            <th>Emissão</th>
            <td>
              Gerado pela AGRYN em{" "}
              {new Date(generatedAt).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </td>
          </tr>
        </tbody>
      </table>

      <h2>Diagnóstico executivo</h2>
      <div className="report-callout">{executiveSummary}</div>

      <h2>1. Resultados por talhão</h2>
      <table className="report-data-table">
        <thead>
          <tr>
            <th>Talhão</th>
            <th>Cultura</th>
            <th>Safra</th>
            <th>Área (ha)</th>
            <th>NDVI médio</th>
            <th>Última análise</th>
            <th>Prioridade</th>
          </tr>
        </thead>
        <tbody>
          {plots.map((row) => (
            <tr key={row.plot.id}>
              <td>{row.plot.name}</td>
              <td>{row.plot.crop}</td>
              <td>{row.plot.season || "—"}</td>
              <td>{row.plot.areaHectares.toLocaleString("pt-BR")}</td>
              <td>{row.ndviMean !== null ? row.ndviMean.toFixed(2) : "—"}</td>
              <td>{row.ndviDate ? new Date(row.ndviDate).toLocaleDateString("pt-BR") : "Não processado"}</td>
              <td>
                <span className={`report-priority report-priority-${row.priority}`}>
                  {priorityLabels[row.priority]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="report-chart-card">
        <h3>NDVI médio por talhão</h3>
        <BarChart data={ndviChart} formatValue={(value) => value.toFixed(2)} />
      </div>

      <h2>2. Custos</h2>
      <table className="report-data-table">
        <thead>
          <tr>
            <th>Talhão</th>
            <th>Total</th>
            <th>Custo/ha</th>
            <th>Lançamentos</th>
          </tr>
        </thead>
        <tbody>
          {plots.map((row) => (
            <tr key={row.plot.id}>
              <td>{row.plot.name}</td>
              <td>{row.costTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
              <td>{row.costPerHectare.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
              <td>{row.costEntries}</td>
            </tr>
          ))}
          <tr className="report-total-row">
            <td>Total da propriedade</td>
            <td>{totalCost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
            <td />
            <td />
          </tr>
        </tbody>
      </table>
      <div className="report-chart-grid">
        <div className="report-chart-card">
          <h3>Custo por talhão</h3>
          <BarChart
            data={costByPlotChart}
            formatValue={(value) =>
              value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
            }
            color="var(--warning)"
          />
        </div>
        <div className="report-chart-card">
          <h3>Custo por categoria</h3>
          <BarChart
            data={costByCategoryChart}
            formatValue={(value) =>
              value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
            }
            color="var(--info)"
          />
        </div>
      </div>

      <h2>3. Caderno de campo</h2>
      <table className="report-data-table">
        <thead>
          <tr>
            <th>Talhão</th>
            <th>Atividades concluídas</th>
            <th>Atividades planejadas</th>
          </tr>
        </thead>
        <tbody>
          {plots.map((row) => (
            <tr key={row.plot.id}>
              <td>{row.plot.name}</td>
              <td>{row.activitiesCompleted}</td>
              <td>{row.activitiesPlanned}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Conclusão</h2>
      <p>{conclusion}</p>

      <div className="report-disclaimer">
        Relatório gerado automaticamente pela AGRYN com base nos dados registrados na conta. Não
        substitui laudo técnico de engenheiro(a) agrônomo(a) responsável, que deve validar a
        recomendação final considerando textura do solo, histórico de produtividade, condições
        climáticas e legislação aplicável.
      </div>
    </article>
  );
}
