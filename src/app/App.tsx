import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/AppShell";
import { AuthScreen } from "../components/AuthScreen";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { logEvent } from "../lib/telemetry";
import { evaluateRecommendationReadiness } from "../domain/safety";
import { CalculatorsModule } from "../features/calculators/CalculatorsModule";
import { CostCenter } from "../features/costs/CostCenter";
import { FertilizationModule } from "../features/fertilization/FertilizationModule";
import { AssistantModule } from "../features/assistant/AssistantModule";
import { DiagnosisModule } from "../features/diagnosis/DiagnosisModule";
import { PrivacyModule } from "../features/privacy/PrivacyModule";
import { MarketModule } from "../features/market/MarketModule";
import { WeatherModule } from "../features/weather/WeatherModule";
import { Dashboard } from "../features/dashboard/Dashboard";
import { FieldNotebook } from "../features/fieldbook/FieldNotebook";
import { ModuleHub } from "../features/modules/ModuleHub";
import { MappingModule } from "../features/mapping/MappingModule";
import { useNdviHistory } from "../features/ndvi/historyStore";
import { NdviModule } from "../features/ndvi/NdviModule";
import { ImportLocalDataDialog } from "../features/onboarding/ImportLocalDataDialog";
import { PortfolioPanel } from "../features/portfolio/PortfolioPanel";
import { PropertyManager } from "../features/properties/PropertyManager";
import { ReportModule } from "../features/reports/ReportModule";
import { SoilModule } from "../features/soil/SoilModule";
import { useSoilAnalyses } from "../features/soil/soilStore";
import { TimelineModule } from "../features/timeline/TimelineModule";
import { SafetyCenter } from "../features/safety/SafetyCenter";
import { effectivePlanId, trialAlreadyUsed } from "../domain/plans";
import { useAgriculturalContext } from "../lib/useAgriculturalContext";
import { useAuth } from "../lib/useAuth";
import { useFieldRecords } from "../lib/useFieldRecords";
import { loadPreferences, savePreferences, type ThemePreference } from "../lib/preferences";
import type { AppView } from "./navigation";
import { createProCheckout } from "../features/billing/billingClient";

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
  "assistente",
  "diagnostico",
  "clima",
  "mercado",
  "calculadoras",
  "caderno",
  "custos",
  "relatorios",
  "privacidade",
  "seguranca",
];

export function App() {
  const initialPreferences = useMemo(() => loadPreferences(), []);
  const [activeView, setActiveView] = useState<AppView>(
    getInitialView(initialPreferences.lastView),
  );
  const [theme, setTheme] = useState<ThemePreference>(initialPreferences.theme);
  const auth = useAuth();
  const agriculture = useAgriculturalContext(auth.userId);
  const fieldBook = useFieldRecords(auth.userId);
  const ndviHistory = useNdviHistory(auth.userId);
  const soil = useSoilAnalyses(auth.userId);
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
      <ErrorBoundary resetKey={activeView} label="esta tela">
      {activeView === "inicio" && (
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
          onNavigate={navigate}
        />
      )}
      {activeView === "assistente" && (
        <AssistantModule accessToken={auth.session?.access_token ?? ""} onNavigate={navigate} />
      )}
      {activeView === "diagnostico" && (
        <DiagnosisModule accessToken={auth.session?.access_token ?? ""} onNavigate={navigate} />
      )}
      {activeView === "clima" && <WeatherModule agriculture={agriculture} onNavigate={navigate} />}
      {activeView === "mercado" && (
        <MarketModule
          agriculture={agriculture}
          records={fieldBook.records}
          onNavigate={navigate}
        />
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
      </ErrorBoundary>
    </AppShell>
  );
}

function getInitialView(lastView: string): AppView {
  const requestedView = new URLSearchParams(window.location.search).get("view") as AppView | null;
  if (requestedView && validViews.includes(requestedView)) return requestedView;
  return validViews.includes(lastView as AppView) ? (lastView as AppView) : "inicio";
}
