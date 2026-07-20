import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/AppShell";
import { AuthScreen } from "../components/AuthScreen";
import { evaluateRecommendationReadiness } from "../domain/safety";
import { CostCenter } from "../features/costs/CostCenter";
import { Dashboard } from "../features/dashboard/Dashboard";
import { FieldNotebook } from "../features/fieldbook/FieldNotebook";
import { ModuleHub } from "../features/modules/ModuleHub";
import { NdviModule } from "../features/ndvi/NdviModule";
import { ImportLocalDataDialog } from "../features/onboarding/ImportLocalDataDialog";
import { PortfolioPanel } from "../features/portfolio/PortfolioPanel";
import { PropertyManager } from "../features/properties/PropertyManager";
import { SafetyCenter } from "../features/safety/SafetyCenter";
import { effectivePlanId, trialAlreadyUsed } from "../domain/plans";
import { useAgriculturalContext } from "../lib/useAgriculturalContext";
import { useAuth } from "../lib/useAuth";
import { useFieldRecords } from "../lib/useFieldRecords";
import { loadPreferences, savePreferences, type ThemePreference } from "../lib/preferences";
import type { AppView } from "./navigation";

const validViews: AppView[] = [
  "inicio",
  "carteira",
  "propriedades",
  "modulos",
  "ndvi",
  "caderno",
  "custos",
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
  const safety = useMemo(() => evaluateRecommendationReadiness(), []);

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
  }

  if (auth.loading) {
    return <div className="auth-screen" aria-busy="true" />;
  }

  if (!auth.session || !auth.userId) {
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
      {activeView === "inicio" && (
        <Dashboard
          safety={safety}
          onNavigate={navigate}
          agriculture={agriculture}
          records={fieldBook.records}
          name={auth.profile?.nome?.split(" ")[0] ?? ""}
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
          planId={effectivePlanId(auth.profile?.plano, auth.profile?.trialAte)}
          trialAvailable={!trialAlreadyUsed(auth.profile?.trialAte)}
          onStartTrial={() => void auth.startTrial()}
        />
      )}
      {activeView === "modulos" && <ModuleHub />}
      {activeView === "ndvi" && (
        <NdviModule
          onNavigate={navigate}
          agriculture={agriculture}
          accessToken={auth.session?.access_token ?? ""}
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
      {activeView === "seguranca" && <SafetyCenter safety={safety} />}
    </AppShell>
  );
}

function getInitialView(lastView: string): AppView {
  const requestedView = new URLSearchParams(window.location.search).get("view") as AppView | null;
  if (requestedView && validViews.includes(requestedView)) return requestedView;
  return validViews.includes(lastView as AppView) ? (lastView as AppView) : "inicio";
}
