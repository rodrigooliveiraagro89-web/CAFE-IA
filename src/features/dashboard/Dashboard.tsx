import {
  ArrowRight,
  Building2,
  Camera,
  Circle,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  CloudSun,
  FileText,
  FlaskConical,
  LandPlot,
  type LucideIcon,
  Satellite,
  ShieldCheck,
  Sprout,
} from "lucide-react";
import type { AppView } from "../../app/navigation";
import { MetricCard } from "../../components/ui/MetricCard";
import { ModuleCard } from "../../components/ui/ModuleCard";
import { AlertsPanel } from "../alerts/AlertsPanel";
import { buildAlerts } from "../../domain/alerts";
import { computeSoilIndices, indexLabel } from "../../domain/soilHealth";
import { propertyLocation } from "../../domain/agriculturalContext";
import { summarizeCosts, type FieldRecord } from "../../domain/fieldRecords";
import type { SafetyCheck } from "../../domain/safety";
import type { AgriculturalController } from "../../lib/useAgriculturalContext";
import type { NdviResult } from "../ndvi/types";
import type { SoilAnalysis } from "../soil/soilStore";
import { moduleCatalog } from "./moduleCatalog";

type DashboardProps = {
  safety: SafetyCheck;
  onNavigate: (view: AppView) => void;
  agriculture: AgriculturalController;
  records: FieldRecord[];
  ndviHistory: NdviResult[];
  soilAnalyses: SoilAnalysis[];
  name: string;
};

type OnboardingStep = {
  id: string;
  label: string;
  description: string;
  done: boolean;
  view: AppView;
  icon: LucideIcon;
};

function OnboardingChecklist({
  steps,
  onNavigate,
}: {
  steps: OnboardingStep[];
  onNavigate: (view: AppView) => void;
}) {
  const doneCount = steps.filter((step) => step.done).length;
  const progress = Math.round((doneCount / steps.length) * 100);
  return (
    <section className="panel-card onboarding-panel" aria-labelledby="onboarding-title">
      <div className="panel-title">
        <ClipboardCheck size={21} />
        <div>
          <span className="eyebrow">Primeiros passos</span>
          <h2 id="onboarding-title">Configure sua operação na AGRYN</h2>
        </div>
      </div>
      <div className="onboarding-progress">
        <div className="onboarding-progress-head">
          <span>
            {doneCount} de {steps.length} etapas concluídas
          </span>
          <strong>{progress}%</strong>
        </div>
        <div
          className="onboarding-progress-bar"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <i style={{ width: `${progress}%` }} />
        </div>
      </div>
      <ol className="onboarding-steps">
        {steps.map((step, index) => (
          <li key={step.id} className="onboarding-step" data-done={step.done}>
            <span className="onboarding-step-status">
              {step.done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
            </span>
            <span className="onboarding-step-body">
              <strong>
                {index + 1}. {step.label}
              </strong>
              <small>{step.description}</small>
            </span>
            <button
              className={step.done ? "secondary-button" : "primary-button"}
              type="button"
              onClick={() => onNavigate(step.view)}
            >
              <step.icon size={16} aria-hidden="true" />
              {step.done ? "Revisar" : "Começar"}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

const featuredModuleIds = ["solo", "visao", "ndvi", "recomendacoes", "clima", "defensivos", "mapa", "caderno"];
const featuredModules = featuredModuleIds
  .map((id) => moduleCatalog.find((module) => module.id === id))
  .filter((module): module is NonNullable<typeof module> => Boolean(module));

function gaugeColor(value: number): string {
  if (value >= 80) return "#059669";
  if (value >= 60) return "#65a30d";
  if (value >= 40) return "#d97706";
  return "#dc2626";
}

// Medidor semicircular (0–100) — a leitura "de bater o olho" da saúde do solo.
function HealthGauge({ label, value }: { label: string; value: number | null }) {
  const arco = Math.PI * 34; // comprimento do semicírculo (raio 34)
  const preenchido = value === null ? 0 : arco * (value / 100);
  const cor = value === null ? "var(--border)" : gaugeColor(value);
  return (
    <div className="health-gauge">
      <svg viewBox="0 0 80 46" className="gauge-svg" role="img" aria-label={`${label}: ${value ?? "sem dados"}`}>
        <path d="M6 42 A34 34 0 0 1 74 42" fill="none" stroke="var(--border)" strokeWidth="7" strokeLinecap="round" />
        {value !== null && (
          <path
            d="M6 42 A34 34 0 0 1 74 42"
            fill="none"
            stroke={cor}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`${preenchido} ${arco}`}
          />
        )}
        <text x="40" y="40" textAnchor="middle" className="gauge-value" style={{ fill: cor }}>
          {value ?? "—"}
        </text>
      </svg>
      <span className="gauge-label">{label}</span>
      <small>{indexLabel(value)}</small>
    </div>
  );
}

export function Dashboard({ safety, onNavigate, agriculture, records, ndviHistory, soilAnalyses, name }: DashboardProps) {
  const hour = new Date().getHours();
  const salutation = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const isNewAccount = agriculture.state.properties.length === 0 || agriculture.state.plots.length === 0;
  const onboardingSteps: OnboardingStep[] = [
    {
      id: "propriedade",
      label: "Cadastrar propriedade",
      description: "Identifique a fazenda ou o cliente que você atende.",
      done: agriculture.state.properties.length > 0,
      view: "propriedades",
      icon: Building2,
    },
    {
      id: "talhao",
      label: "Cadastrar talhão",
      description: "Adicione a área produtiva com cultura e safra.",
      done: agriculture.state.plots.length > 0,
      view: "propriedades",
      icon: LandPlot,
    },
    {
      id: "dados",
      label: "Processar NDVI ou registrar atividade",
      description: "Rode o monitoramento por satélite ou anote uma atividade no caderno de campo.",
      done: records.length > 0 || ndviHistory.length > 0,
      view: "ndvi",
      icon: Satellite,
    },
    {
      id: "relatorio",
      label: "Gerar o relatório da propriedade",
      description: "Consolide os dados num documento pronto para entregar ao produtor.",
      done: false,
      view: "relatorios",
      icon: FileText,
    },
  ];
  const plotRecords = records.filter((record) => record.plotId === agriculture.selectedPlot?.id);
  const plannedActivities = plotRecords.filter((record) => record.status === "planejada").length;
  const costSummary = summarizeCosts(plotRecords);
  const completed = plotRecords.filter((record) => record.status === "concluida").length;
  const propertyPlots = agriculture.state.plots.filter(
    (plot) => plot.propertyId === agriculture.selectedProperty?.id,
  );
  const alerts = buildAlerts(propertyPlots, records, ndviHistory, soilAnalyses);
  const latestSoil = soilAnalyses
    .filter((analysis) => analysis.plotId === agriculture.selectedPlot?.id)
    .sort(
      (a, b) =>
        new Date(b.analysisDate ?? b.createdAt).getTime() -
        new Date(a.analysisDate ?? a.createdAt).getTime(),
    )[0];
  const soilIndices = latestSoil ? computeSoilIndices(latestSoil.values) : null;
  const metrics = [
    { label: "Área selecionada", value: agriculture.selectedPlot ? `${agriculture.selectedPlot.areaHectares.toLocaleString("pt-BR")} ha` : "—", detail: agriculture.selectedPlot?.name ?? "Selecione um talhão", icon: LandPlot },
    { label: "Atividades abertas", value: agriculture.selectedPlot ? String(plannedActivities) : "—", detail: completed ? `${completed} concluídas` : "Caderno de campo", icon: ClipboardCheck },
    { label: "Custos registrados", value: costSummary.total > 0 ? costSummary.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }) : "—", detail: costSummary.entries ? `${costSummary.entries} lançamentos` : "Nenhum valor informado", icon: CircleDollarSign },
    { label: "Monitoramento NDVI", value: agriculture.selectedPlot?.geometry ? "Pronto" : "—", detail: agriculture.selectedPlot?.geometry ? "Limite geográfico disponível" : "Cadastre ou desenhe o limite", icon: Satellite },
  ];

  return (
    <div className="page-stack dashboard-page">
      {isNewAccount && <OnboardingChecklist steps={onboardingSteps} onNavigate={onNavigate} />}
      <section className="agryn-hero" aria-labelledby="welcome-title">
        <div className="hero-copy">
          <span className="eyebrow">Inteligência que cultiva resultados</span>
          <h1 id="welcome-title">{salutation}{name ? `, ${name}` : ""}.</h1>
          <p>{agriculture.selectedPlot ? `Acompanhe o cafezal no ${agriculture.selectedPlot.name}, safra ${agriculture.selectedPlot.season}.` : "Conecte uma propriedade para transformar análises, clima e manejo em decisões rastreáveis para o café."}</p>
          <div className="hero-actions">
            <button className="primary-button" type="button" onClick={() => onNavigate(agriculture.selectedPlot ? "analise-solo" : "propriedades")}><FlaskConical size={18} /> {agriculture.selectedPlot ? "Ler análise de solo" : "Cadastrar propriedade"}</button>
            <button className="secondary-button" type="button" onClick={() => onNavigate("diagnostico")}><Camera size={18} /> Diagnosticar planta</button>
          </div>
        </div>
        <aside className="agryn-index-card soil-health-card" aria-label="Saúde do solo">
          <div className="index-heading">
            <span className="index-orb"><FlaskConical size={22} /></span>
            <div>
              <span className="eyebrow">Saúde do solo</span>
              <strong>{latestSoil ? "Do seu último laudo" : "Sem laudo ainda"}</strong>
            </div>
          </div>
          {soilIndices ? (
            <>
              <div className="soil-gauges">
                <HealthGauge label="Fertilidade" value={soilIndices.fertilidade} />
                <HealthGauge label="Nutricional" value={soilIndices.nutricional} />
                <HealthGauge label="Sustentab." value={soilIndices.sustentabilidade} />
              </div>
              <button type="button" className="index-cta" onClick={() => onNavigate("adubacao")}>
                <FlaskConical size={16} /> Ver calagem e adubação
              </button>
            </>
          ) : (
            <>
              <p>Envie o laudo do talhão e o painel se preenche sozinho — fertilidade, nutrição e sustentabilidade, mais a recomendação de calagem e adubação.</p>
              <button type="button" className="index-cta" onClick={() => onNavigate("analise-solo")}>
                <FlaskConical size={16} /> Ler análise de solo
              </button>
            </>
          )}
        </aside>
      </section>

      {agriculture.selectedProperty && !isNewAccount && (
        <AlertsPanel alerts={alerts} onNavigate={onNavigate} />
      )}

      {agriculture.selectedProperty && (
        <section className="active-context-strip">
          <div><span className="context-icon"><Sprout size={19} /></span><span><small>Propriedade</small><strong>{agriculture.selectedProperty.name}</strong><em>{propertyLocation(agriculture.selectedProperty)}</em></span></div>
          <div><small>Talhão ativo</small><strong>{agriculture.selectedPlot?.name ?? "Selecione uma área"}</strong><em>{propertyPlots.length} cadastrados</em></div>
          <div><small>Cultura e safra</small><strong>{agriculture.selectedPlot?.crop ?? "Não informada"}</strong><em>{agriculture.selectedPlot?.season ?? "Safra não informada"}</em></div>
          <button type="button" onClick={() => onNavigate("propriedades")}>Alterar contexto <ArrowRight size={15} /></button>
        </section>
      )}

      <section className="metrics-grid" aria-label="Indicadores principais">{metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}</section>
      <section aria-labelledby="modules-title">
        <div className="section-heading"><div><span className="eyebrow">Acesso rápido</span><h2 id="modules-title">Módulos da operação</h2><p>Ferramentas organizadas para reduzir etapas no trabalho de campo.</p></div><button className="text-button" type="button" onClick={() => onNavigate("modulos")}>Ver todos os módulos <ArrowRight size={16} /></button></div>
        <div className="module-grid">{featuredModules.map((module) => <ModuleCard key={module.id} module={module} compact />)}</div>
      </section>
      <section className="decision-grid" aria-label="Condição e segurança da operação">
        <article className="field-status-card">
          <div className="card-heading"><span className="field-status-icon"><CloudSun size={22} /></span><div><span className="eyebrow">Contexto operacional</span><h2>{agriculture.selectedPlot ? "Talhão pronto para receber dados" : "Configure a primeira área produtiva"}</h2></div></div>
          <p>{agriculture.selectedPlot ? "O contexto agrícola está ativo. Clima, análises, NDVI, atividades e custos podem ser associados a esta área." : "Nenhuma propriedade e talhão estão selecionados. Cadastre o contexto real para ativar indicadores sem dados simulados."}</p>
          <button type="button" onClick={() => onNavigate("propriedades")}>{agriculture.selectedPlot ? "Revisar contexto" : "Cadastrar propriedade"} <ArrowRight size={15} /></button>
        </article>
        <article className="governance-card" data-ready={safety.eligible}>
          <div className="card-heading"><span className="governance-icon"><ShieldCheck size={22} /></span><div><span className="eyebrow">Governança técnica</span><h2>{safety.eligible ? "Dados mínimos validados" : "Recomendação protegida"}</h2></div></div>
          <p>{safety.message}</p>
          <button type="button" onClick={() => onNavigate("seguranca")}>Ver critérios de validação <ArrowRight size={15} /></button>
        </article>
      </section>
      <section className="field-note" aria-label="Informação de contexto"><FlaskConical size={18} /><p>A AGRYN nunca apresenta recomendações técnicas sem cultura, área, data, unidades, dados utilizados e nível de confiança.</p></section>
    </div>
  );
}
