import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/AppShell";
import { AuthScreen } from "../components/AuthScreen";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { logEvent } from "../lib/telemetry";
import { evaluateRecommendationReadiness } from "../domain/safety";
// Dashboard é a tela inicial — fica eager para o primeiro paint ser instantâneo.
import { Dashboard } from "../features/dashboard/Dashboard";
import { ImportLocalDataDialog } from "../features/onboarding/ImportLocalDataDialog";
import { WelcomeScreen } from "../features/onboarding/WelcomeScreen";
import { AreaOnboarding } from "../features/onboarding/AreaOnboarding";
import { useNdviHistory } from "../features/ndvi/historyStore";
import { useSoilAnalyses } from "../features/soil/soilStore";
// Recupera de chunk obsoleto: após um deploy, os hashes mudam e o index antigo
// (ainda aberto no navegador) tenta baixar um chunk que sumiu → "Failed to fetch
// dynamically imported module". Recarregamos a página UMA vez para pegar a versão
// nova; o flag em sessionStorage evita laço (é limpo no boot, em main.tsx).
function retryImport<T>(factory: () => Promise<T>): Promise<T> {
  return factory().catch((error: unknown) => {
    const KEY = "agryn:chunk-reload";
    try {
      if (!sessionStorage.getItem(KEY)) {
        sessionStorage.setItem(KEY, "1");
        window.location.reload();
        return new Promise<T>(() => {}); // segura enquanto a página recarrega
      }
    } catch {
      /* sem sessionStorage: propaga o erro para o ErrorBoundary */
    }
    throw error;
  });
}

// Módulos de rota carregados sob demanda (code-splitting) — Leaflet/NDVI/mapa e
// demais telas saem do bundle inicial e só baixam quando o usuário abre.
const CalculatorsModule = lazy(() => retryImport(() => import("../features/calculators/CalculatorsModule")).then((m) => ({ default: m.CalculatorsModule })));
const CostCenter = lazy(() => retryImport(() => import("../features/costs/CostCenter")).then((m) => ({ default: m.CostCenter })));
const FertilizationModule = lazy(() => retryImport(() => import("../features/fertilization/FertilizationModule")).then((m) => ({ default: m.FertilizationModule })));
const AssistantModule = lazy(() => retryImport(() => import("../features/assistant/AssistantModule")).then((m) => ({ default: m.AssistantModule })));
const DiagnosisModule = lazy(() => retryImport(() => import("../features/diagnosis/DiagnosisModule")).then((m) => ({ default: m.DiagnosisModule })));
const PrivacyModule = lazy(() => retryImport(() => import("../features/privacy/PrivacyModule")).then((m) => ({ default: m.PrivacyModule })));
const WeatherModule = lazy(() => retryImport(() => import("../features/weather/WeatherModule")).then((m) => ({ default: m.WeatherModule })));
const FieldNotebook = lazy(() => retryImport(() => import("../features/fieldbook/FieldNotebook")).then((m) => ({ default: m.FieldNotebook })));
const CropPlanModule = lazy(() => retryImport(() => import("../features/cropplan/CropPlanModule")).then((m) => ({ default: m.CropPlanModule })));
const ClimateDiaryModule = lazy(() => retryImport(() => import("../features/climate/ClimateDiaryModule")).then((m) => ({ default: m.ClimateDiaryModule })));
const ModuleHub = lazy(() => retryImport(() => import("../features/modules/ModuleHub")).then((m) => ({ default: m.ModuleHub })));
const MappingModule = lazy(() => retryImport(() => import("../features/mapping/MappingModule")).then((m) => ({ default: m.MappingModule })));
const NdviModule = lazy(() => retryImport(() => import("../features/ndvi/NdviModule")).then((m) => ({ default: m.NdviModule })));
const PortfolioPanel = lazy(() => retryImport(() => import("../features/portfolio/PortfolioPanel")).then((m) => ({ default: m.PortfolioPanel })));
const PropertyManager = lazy(() => retryImport(() => import("../features/properties/PropertyManager")).then((m) => ({ default: m.PropertyManager })));
const ReportModule = lazy(() => retryImport(() => import("../features/reports/ReportModule")).then((m) => ({ default: m.ReportModule })));
const SoilModule = lazy(() => retryImport(() => import("../features/soil/SoilModule")).then((m) => ({ default: m.SoilModule })));
const TimelineModule = lazy(() => retryImport(() => import("../features/timeline/TimelineModule")).then((m) => ({ default: m.TimelineModule })));
const SafetyCenter = lazy(() => retryImport(() => import("../features/safety/SafetyCenter")).then((m) => ({ default: m.SafetyCenter })));
import { effectivePlanId, trialAlreadyUsed } from "../domain/plans";
import { useAgriculturalContext } from "../lib/useAgriculturalContext";
import { useAuth } from "../lib/useAuth";
import { useFieldRecords } from "../lib/useFieldRecords";
import { useCropPlans } from "../features/cropplan/useCropPlan";
import { useClimateDiary } from "../features/climate/climateDiaryStore";
import { loadPreferences, savePreferences, type ThemePreference } from "../lib/preferences";
import type { AppView } from "./navigation";
import { createProCheckout } from "../features/billing/billingClient";
import { linkPendingCollaborations } from "../features/properties/collaboratorsClient";
import { buildAssistantContext } from "../features/assistant/assistantContext";
import { buildAlerts } from "../domain/alerts";

const validViews: AppView[] = [
  "inicio",
  "linha-do-tempo",
  "carteira",
  "propriedades",
  "mapeamento",
  "modulos",
  "ndvi",
  "analise-solo",
  "adubacao",
  "plano-safra",
  "assistente",
  "diagnostico",
  "clima",
  "diario-clima",
  "calculadoras",
  "caderno",
  "custos",
  "relatorios",
  "privacidade",
  "seguranca",
];

export function App() {
  const initialPreferences = useMemo(() => loadPreferences(), []);
  const [onboarding, setOnboarding] = useState(false);
  const [activeView, setActiveView] = useState<AppView>(
    getInitialView(initialPreferences.lastView),
  );
  const [theme, setTheme] = useState<ThemePreference>(initialPreferences.theme);
  const auth = useAuth();
  const agriculture = useAgriculturalContext(auth.userId);
  const fieldBook = useFieldRecords(auth.userId);
  const cropPlan = useCropPlans(auth.userId);
  const climateDiary = useClimateDiary(auth.userId);
  const ndviHistory = useNdviHistory(auth.userId);
  const soil = useSoilAnalyses(auth.userId, agriculture.demoActive);
  const safety = useMemo(() => {
    const plot = agriculture.selectedPlot;
    if (!plot) return evaluateRecommendationReadiness();
    const analysis = soil.analyses
      .filter((item) => item.plotId === plot.id)
      .sort(
        (a, b) =>
          new Date(b.analysisDate ?? b.createdAt).getTime() -
          new Date(a.analysisDate ?? a.createdAt).getTime(),
      )[0];
    if (!analysis) return evaluateRecommendationReadiness();
    return evaluateRecommendationReadiness({
      propertyId: agriculture.selectedProperty?.id,
      plotId: plot.id,
      laboratory: analysis.laboratory ?? undefined,
      sampledAt: analysis.analysisDate ?? undefined,
      pH: analysis.values.ph ?? undefined,
      organicMatter: analysis.values.organicMatter ?? undefined,
      phosphorus: analysis.values.p ?? undefined,
      potassium: analysis.values.k ?? undefined,
      calcium: analysis.values.ca ?? undefined,
      magnesium: analysis.values.mg ?? undefined,
      cec: analysis.values.ctc ?? undefined,
      baseSaturation: analysis.values.vPercent ?? undefined,
    });
  }, [agriculture.selectedPlot, agriculture.selectedProperty, soil.analyses]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    savePreferences({ theme, lastView: activeView });
  }, [activeView, theme]);

  // Ao logar, vincula convites de colaboração feitos ao e-mail do usuário.
  useEffect(() => {
    if (auth.userId) void linkPendingCollaborations();
  }, [auth.userId]);

  // Conta nova (logada, sem propriedades e fora do modo demo): tela de boas-vindas.
  const showWelcome =
    Boolean(auth.userId) && agriculture.state.properties.length === 0 && !agriculture.demoActive;

  // Briefing do talhão selecionado para o AGRYN IA responder com dados reais.
  const assistantContext = useMemo(() => {
    const plot = agriculture.selectedPlot;
    if (!plot) return "";
    const soilForPlot =
      soil.analyses
        .filter((a) => a.plotId === plot.id)
        .sort(
          (a, b) =>
            new Date(b.analysisDate ?? b.createdAt).getTime() -
            new Date(a.analysisDate ?? a.createdAt).getTime(),
        )[0] ?? null;
    const ndviForPlot =
      ndviHistory.history
        .filter((n) => n.plotId === plot.id)
        .sort((a, b) => new Date(b.acquiredAt).getTime() - new Date(a.acquiredAt).getTime())[0] ?? null;
    const propertyPlots = agriculture.state.plots.filter((p) => p.propertyId === plot.propertyId);
    const alerts = buildAlerts(propertyPlots, fieldBook.records, ndviHistory.history, soil.analyses)
      .filter((a) => !a.plotId || a.plotId === plot.id)
      .map((a) => a.title);
    return buildAssistantContext({
      property: agriculture.selectedProperty,
      plot,
      soil: soilForPlot,
      ndviMean: ndviForPlot?.statistics.mean ?? null,
      ndviDate: ndviForPlot?.acquiredAt ?? null,
      alerts,
    });
  }, [
    agriculture.selectedPlot,
    agriculture.selectedProperty,
    agriculture.state.plots,
    soil.analyses,
    ndviHistory.history,
    fieldBook.records,
  ]);

  function navigate(view: AppView) {
    setActiveView(view);
    const url = new URL(window.location.href);
    if (view === "inicio") url.searchParams.delete("view");
    else url.searchParams.set("view", view);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Telemetria de uso: quais módulos o produtor realmente abre.
    logEvent("view", view);
  }

  async function subscribe() {
    if (!auth.session?.access_token) return;
    try {
      const url = await createProCheckout(auth.session.access_token, auth.profile?.nome ?? "");
      window.location.assign(url);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Não foi possível abrir o checkout.");
    }
  }

  if (auth.loading) {
    return <div className="auth-screen" aria-busy="true" />;
  }

  if (!auth.session || !auth.userId || auth.recovering) {
    return <AuthScreen auth={auth} />;
  }

  return (
    <AppShell
      activeView={activeView}
      onNavigate={navigate}
      theme={theme}
      onToggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
      selectedProperty={agriculture.selectedProperty}
      selectedPlot={agriculture.selectedPlot}
      profile={auth.profile}
      onSignOut={auth.signOut}
    >
      <ImportLocalDataDialog userId={auth.userId} onDone={() => window.location.reload()} />
      {agriculture.demoActive && (
        <div className="demo-banner" role="status">
          <span>🧪 <strong>Modo demonstração</strong> — dados fictícios, nada é salvo.</span>
          <button type="button" onClick={() => { agriculture.exitDemo(); navigate("inicio"); }}>
            Sair do exemplo
          </button>
        </div>
      )}
      <ErrorBoundary resetKey={activeView} label="esta tela">
      <Suspense fallback={<div className="route-loading" role="status">Carregando…</div>}>
      {activeView === "inicio" && showWelcome && onboarding && (
        <AreaOnboarding
          agriculture={agriculture}
          producerName={auth.profile?.nome ?? ""}
          onDone={() => setOnboarding(false)}
          onCancel={() => setOnboarding(false)}
        />
      )}
      {activeView === "inicio" && showWelcome && !onboarding && (
        <WelcomeScreen
          name={auth.profile?.nome?.split(" ")[0]}
          onLoadDemo={agriculture.loadDemo}
          onStart={() => setOnboarding(true)}
        />
      )}
      {activeView === "inicio" && !showWelcome && (
        <Dashboard
          safety={safety}
          onNavigate={navigate}
          agriculture={agriculture}
          records={fieldBook.records}
          ndviHistory={ndviHistory.history}
          soilAnalyses={soil.analyses}
          name={auth.profile?.nome?.split(" ")[0] ?? ""}
        />
      )}
      {activeView === "linha-do-tempo" && (
        <TimelineModule
          agriculture={agriculture}
          records={fieldBook.records}
          ndviHistory={ndviHistory.history}
          soilAnalyses={soil.analyses}
          onNavigate={navigate}
        />
      )}
      {activeView === "carteira" && (
        <PortfolioPanel
          agriculture={agriculture}
          records={fieldBook.records}
          onNavigate={navigate}
        />
      )}
      {activeView === "propriedades" && (
        <PropertyManager
          agriculture={agriculture}
          userId={auth.userId}
          planId={effectivePlanId(auth.profile?.plano, auth.profile?.trialAte)}
          trialAvailable={!trialAlreadyUsed(auth.profile?.trialAte)}
          onStartTrial={() => void auth.startTrial()}
          onSubscribe={() => void subscribe()}
        />
      )}
      {activeView === "mapeamento" && (
        <MappingModule
          agriculture={agriculture}
          planId={effectivePlanId(auth.profile?.plano, auth.profile?.trialAte)}
          trialAvailable={!trialAlreadyUsed(auth.profile?.trialAte)}
          onStartTrial={() => void auth.startTrial()}
          onSubscribe={() => void subscribe()}
          onNavigate={navigate}
        />
      )}
      {activeView === "modulos" && <ModuleHub />}
      {activeView === "ndvi" && (
        <NdviModule
          onNavigate={navigate}
          agriculture={agriculture}
          accessToken={auth.session?.access_token ?? ""}
          history={ndviHistory.history}
          onAddResult={ndviHistory.addResult}
          onCreateInspection={(input) => {
            if (!agriculture.selectedProperty || !agriculture.selectedPlot) return;
            fieldBook.addRecord(
              agriculture.selectedProperty.id,
              agriculture.selectedPlot.id,
              input,
            );
          }}
        />
      )}
      {activeView === "caderno" && (
        <FieldNotebook
          agriculture={agriculture}
          records={fieldBook.records}
          onAdd={fieldBook.addRecord}
          onToggle={fieldBook.toggleRecord}
          onRemove={fieldBook.removeRecord}
          onNavigate={navigate}
        />
      )}
      {activeView === "custos" && (
        <CostCenter
          agriculture={agriculture}
          records={fieldBook.records}
          cropPlan={cropPlan}
          onNavigate={navigate}
        />
      )}
      {activeView === "plano-safra" && (
        <CropPlanModule
          agriculture={agriculture}
          cropPlan={cropPlan}
          soilAnalyses={soil.analyses}
          records={fieldBook.records}
          onRegistrarAplicacao={fieldBook.addRecord}
          onRemoverAplicacao={fieldBook.removeRecord}
          onNavigate={navigate}
        />
      )}
      {activeView === "analise-solo" && (
        <SoilModule
          agriculture={agriculture}
          accessToken={auth.session?.access_token ?? ""}
          soil={soil}
          onNavigate={navigate}
        />
      )}
      {activeView === "adubacao" && (
        <FertilizationModule
          key={agriculture.selectedPlot?.id ?? "sem-talhao"}
          agriculture={agriculture}
          soilAnalyses={soil.analyses}
          ndviHistory={ndviHistory.history}
          fieldRecords={fieldBook.records}
          onRegistrarAplicacao={fieldBook.addRecord}
          onNavigate={navigate}
        />
      )}
      {activeView === "assistente" && (
        <AssistantModule
          accessToken={auth.session?.access_token ?? ""}
          onNavigate={navigate}
          context={assistantContext}
          contextPlotName={agriculture.selectedPlot?.name}
        />
      )}
      {activeView === "diagnostico" && (
        <DiagnosisModule accessToken={auth.session?.access_token ?? ""} onNavigate={navigate} />
      )}
      {activeView === "clima" && <WeatherModule agriculture={agriculture} climateDiary={climateDiary} onNavigate={navigate} />}
      {activeView === "diario-clima" && (
        <ClimateDiaryModule agriculture={agriculture} climateDiary={climateDiary} onNavigate={navigate} />
      )}
      {activeView === "calculadoras" && (
        <CalculatorsModule agriculture={agriculture} onNavigate={navigate} />
      )}
      {activeView === "relatorios" && (
        <ReportModule
          agriculture={agriculture}
          records={fieldBook.records}
          ndviHistory={ndviHistory.history}
          soilAnalyses={soil.analyses}
          planId={effectivePlanId(auth.profile?.plano, auth.profile?.trialAte)}
          trialAvailable={!trialAlreadyUsed(auth.profile?.trialAte)}
          onStartTrial={() => void auth.startTrial()}
          onSubscribe={() => void subscribe()}
          onNavigate={navigate}
        />
      )}
      {activeView === "privacidade" && auth.userId && (
        <PrivacyModule
          userId={auth.userId}
          accessToken={auth.session?.access_token ?? ""}
          onSignOut={auth.signOut}
          onNavigate={navigate}
        />
      )}
      {activeView === "seguranca" && <SafetyCenter safety={safety} />}
      </Suspense>
      </ErrorBoundary>
    </AppShell>
  );
}

function getInitialView(lastView: string): AppView {
  const requestedView = new URLSearchParams(window.location.search).get("view") as AppView | null;
  if (requestedView && validViews.includes(requestedView)) return requestedView;
  return validViews.includes(lastView as AppView) ? (lastView as AppView) : "inicio";
}
