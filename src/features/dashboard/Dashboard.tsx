import {
  ArrowRight,
  BellRing,
  Bot,
  Camera,
  ClipboardCheck,
  CloudSun,
  FlaskConical,
  Plus,
  ShieldCheck,
  Sprout,
} from "lucide-react";
import type { AppView } from "../../app/navigation";
import { MetricCard } from "../../components/ui/MetricCard";
import { ModuleCard } from "../../components/ui/ModuleCard";
import type { SafetyCheck } from "../../domain/safety";
import { moduleCatalog } from "./moduleCatalog";

type DashboardProps = {
  safety: SafetyCheck;
  onNavigate: (view: AppView) => void;
};

const featuredModuleIds = ["solo", "foto", "ndvi", "adubacao", "clima", "defensivos", "mapa", "relatorios"];
const featuredModules = featuredModuleIds
  .map((id) => moduleCatalog.find((module) => module.id === id))
  .filter((module): module is NonNullable<typeof module> => Boolean(module));

const metrics = [
  { label: "Análises pendentes", value: "—", detail: "Selecione uma propriedade", icon: ClipboardCheck },
  { label: "Talhões monitorados", value: "—", detail: "Nenhum contexto ativo", icon: Sprout },
  { label: "Alertas climáticos", value: "—", detail: "Sincronize o clima", icon: CloudSun },
  { label: "Recomendações abertas", value: "—", detail: "Aguardando dados válidos", icon: BellRing },
];

export function Dashboard({ safety, onNavigate }: DashboardProps) {
  const hour = new Date().getHours();
  const salutation = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <div className="page-stack dashboard-page">
      <section className="agryn-hero" aria-labelledby="welcome-title">
        <div className="hero-copy">
          <span className="eyebrow">Central agrícola inteligente</span>
          <h1 id="welcome-title">{salutation}, Rodrigo.</h1>
          <p>
            Conecte uma propriedade para transformar análises, clima e manejo em decisões
            rastreáveis para qualquer cultura.
          </p>
          <div className="hero-actions">
            <a className="primary-button" href="./agryn.html?tab=solo">
              <Plus size={18} aria-hidden="true" />
              Nova análise
            </a>
            <a className="secondary-button" href="./agryn.html?tab=foto">
              <Camera size={18} aria-hidden="true" />
              Diagnosticar planta
            </a>
          </div>
        </div>

        <aside className="ai-command-card" aria-label="Assistente AGRYN IA">
          <div className="ai-command-heading">
            <span className="ai-orb"><Bot size={22} aria-hidden="true" /></span>
            <div>
              <span className="eyebrow">AGRYN IA</span>
              <strong>Como posso ajudar na operação?</strong>
            </div>
          </div>
          <a className="ai-prompt-field" href="./agryn.html?tab=ia">
            <span>Pergunte sobre análises, clima ou manejo...</span>
            <ArrowRight size={18} aria-hidden="true" />
          </a>
          <div className="ai-suggestions" aria-label="Sugestões para a AGRYN IA">
            <a href="./agryn.html?tab=ia">Interpretar análise</a>
            <a href="./agryn.html?tab=ia">Ver riscos climáticos</a>
            <a href="./agryn.html?tab=ia">Calcular produto</a>
          </div>
        </aside>
      </section>

      <section className="metrics-grid" aria-label="Indicadores principais">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      <section aria-labelledby="modules-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Acesso rápido</span>
            <h2 id="modules-title">Módulos da operação</h2>
            <p>Ferramentas organizadas para reduzir etapas no trabalho de campo.</p>
          </div>
          <button className="text-button" type="button" onClick={() => onNavigate("modulos")}>
            Ver todos os módulos <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="module-grid">
          {featuredModules.map((module) => (
            <ModuleCard key={module.id} module={module} compact />
          ))}
        </div>
      </section>

      <section className="decision-grid" aria-label="Condição e segurança da operação">
        <article className="field-status-card">
          <div className="card-heading">
            <span className="field-status-icon"><Sprout size={22} aria-hidden="true" /></span>
            <div>
              <span className="eyebrow">Condição geral</span>
              <h2>Lavoura pronta para receber dados</h2>
            </div>
          </div>
          <p>
            Nenhuma propriedade está selecionada. Escolha o contexto da operação para exibir
            índices, alertas e próximos manejos sem recorrer a dados simulados.
          </p>
          <a href="./agryn.html?tab=dashboard">
            Selecionar propriedade <ArrowRight size={15} aria-hidden="true" />
          </a>
        </article>

        <article className="governance-card" data-ready={safety.eligible}>
          <div className="card-heading">
            <span className="governance-icon"><ShieldCheck size={22} aria-hidden="true" /></span>
            <div>
              <span className="eyebrow">Governança técnica</span>
              <h2>{safety.eligible ? "Dados mínimos validados" : "Recomendação protegida"}</h2>
            </div>
          </div>
          <p>{safety.message}</p>
          <button type="button" onClick={() => onNavigate("seguranca")}>
            Ver critérios de validação <ArrowRight size={15} aria-hidden="true" />
          </button>
        </article>
      </section>

      <section className="field-note" aria-label="Informação de contexto">
        <FlaskConical size={18} aria-hidden="true" />
        <p>
          A AGRYN nunca apresenta recomendações técnicas sem cultura, área, data, unidades,
          dados utilizados e nível de confiança.
        </p>
      </section>
    </div>
  );
}
