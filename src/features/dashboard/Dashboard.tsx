import {
  ArrowRight,
  Bot,
  Camera,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  CloudSun,
  FlaskConical,
  LandPlot,
  Plus,
  Satellite,
  ShieldCheck,
  Sprout,
} from "lucide-react";
import type { AppView } from "../../app/navigation";
import { MetricCard } from "../../components/ui/MetricCard";
import { ModuleCard } from "../../components/ui/ModuleCard";
import { propertyLocation } from "../../domain/agriculturalContext";
import { summarizeCosts, type FieldRecord } from "../../domain/fieldRecords";
import type { SafetyCheck } from "../../domain/safety";
import type { AgriculturalController } from "../../lib/useAgriculturalContext";
import { moduleCatalog } from "./moduleCatalog";

type DashboardProps = {
  safety: SafetyCheck;
  onNavigate: (view: AppView) => void;
  agriculture: AgriculturalController;
  records: FieldRecord[];
  name: string;
};

const featuredModuleIds = ["solo", "visao", "ndvi", "recomendacoes", "clima", "defensivos", "mapa", "caderno"];
const featuredModules = featuredModuleIds
  .map((id) => moduleCatalog.find((module) => module.id === id))
  .filter((module): module is NonNullable<typeof module> => Boolean(module));

export function Dashboard({ safety, onNavigate, agriculture, records, name }: DashboardProps) {
  const hour = new Date().getHours();
  const salutation = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const plotRecords = records.filter((record) => record.plotId === agriculture.selectedPlot?.id);
  const plannedActivities = plotRecords.filter((record) => record.status === "planejada").length;
  const costSummary = summarizeCosts(plotRecords);
  const completed = plotRecords.filter((record) => record.status === "concluida").length;
  const propertyPlots = agriculture.state.plots.filter(
    (plot) => plot.propertyId === agriculture.selectedProperty?.id,
  );
  const metrics = [
    { label: "Área selecionada", value: agriculture.selectedPlot ? `${agriculture.selectedPlot.areaHectares.toLocaleString("pt-BR")} ha` : "—", detail: agriculture.selectedPlot?.name ?? "Selecione um talhão", icon: LandPlot },
    { label: "Atividades abertas", value: agriculture.selectedPlot ? String(plannedActivities) : "—", detail: completed ? `${completed} concluídas` : "Caderno de campo", icon: ClipboardCheck },
    { label: "Custos registrados", value: costSummary.total > 0 ? costSummary.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }) : "—", detail: costSummary.entries ? `${costSummary.entries} lançamentos` : "Nenhum valor informado", icon: CircleDollarSign },
    { label: "Monitoramento NDVI", value: agriculture.selectedPlot?.geometry ? "Pronto" : "—", detail: agriculture.selectedPlot?.geometry ? "Limite geográfico disponível" : "Cadastre ou desenhe o limite", icon: Satellite },
  ];

  return (
    <div className="page-stack dashboard-page">
      <section className="agryn-hero" aria-labelledby="welcome-title">
        <div className="hero-copy">
          <span className="eyebrow">Inteligência que cultiva resultados</span>
          <h1 id="welcome-title">{salutation}{name ? `, ${name}` : ""}.</h1>
          <p>{agriculture.selectedPlot ? `Acompanhe ${agriculture.selectedPlot.crop.toLocaleLowerCase("pt-BR")} no ${agriculture.selectedPlot.name}, safra ${agriculture.selectedPlot.season}.` : "Conecte uma propriedade para transformar análises, clima e manejo em decisões rastreáveis para qualquer cultura."}</p>
          <div className="hero-actions">
            <button className="primary-button" type="button" onClick={() => onNavigate(agriculture.selectedPlot ? "caderno" : "propriedades")}><Plus size={18} /> {agriculture.selectedPlot ? "Registrar atividade" : "Cadastrar propriedade"}</button>
            <a className="secondary-button" href="./agryn.html?tab=foto"><Camera size={18} /> Diagnosticar planta</a>
          </div>
        </div>
        <aside className="agryn-index-card" aria-label="Índice AGRYN">
          <div className="index-heading"><span className="index-orb"><Sprout size={22} /></span><div><span className="eyebrow">Índice AGRYN</span><strong>Não calculado</strong></div></div>
          <p>O índice só será exibido quando houver dados suficientes e rastreáveis para o talhão.</p>
          <ul>
            <li data-ready={Boolean(agriculture.selectedPlot)}><CheckCircle2 size={15} /> Talhão e cultura</li>
            <li data-ready={Boolean(agriculture.selectedPlot?.geometry)}><CheckCircle2 size={15} /> Limite geográfico</li>
            <li data-ready={plotRecords.length > 0}><CheckCircle2 size={15} /> Histórico de campo</li>
            <li data-ready={false}><CheckCircle2 size={15} /> Análises e clima sincronizados</li>
          </ul>
          <a href="./agryn.html?tab=ia"><Bot size={16} /> Conversar com a AGRYN IA</a>
        </aside>
      </section>

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
