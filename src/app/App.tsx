import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/AppShell";
import { evaluateRecommendationReadiness } from "../domain/safety";
import { Dashboard } from "../features/dashboard/Dashboard";
import { ModuleHub } from "../features/modules/ModuleHub";
import { NdviModule } from "../features/ndvi/NdviModule";
import { SafetyCenter } from "../features/safety/SafetyCenter";
import { loadPreferences, savePreferences, type ThemePreference } from "../lib/preferences";
import type { AppView } from "./navigation";

const validViews: AppView[] = ["inicio", "modulos", "ndvi", "seguranca"];

export function App() {
  const initialPreferences = useMemo(() => loadPreferences(), []);
  const [activeView, setActiveView] = useState<AppView>(
    getInitialView(initialPreferences.lastView),
  );
  const [theme, setTheme] = useState<ThemePreference>(initialPreferences.theme);
  const safety = useMemo(() => evaluateRecommendationReadiness(), []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    savePreferences({ theme, lastView: activeView });
  }, [activeView, theme]);

  function navigate(view: AppView) {
    setActiveView(view);
    const url = new URL(window.location.href);
    if (view === "ndvi") url.searchParams.set("view", "ndvi");
    else url.searchParams.delete("view");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  return (
    <AppShell
      activeView={activeView}
      onNavigate={navigate}
      theme={theme}
      onToggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
    >
      {activeView === "inicio" && <Dashboard safety={safety} onNavigate={navigate} />}
      {activeView === "modulos" && <ModuleHub />}
      {activeView === "ndvi" && <NdviModule onNavigate={navigate} />}
      {activeView === "seguranca" && <SafetyCenter safety={safety} />}
    </AppShell>
  );
}

function getInitialView(lastView: string): AppView {
  const requestedView = new URLSearchParams(window.location.search).get("view") as AppView | null;
  if (requestedView && validViews.includes(requestedView)) return requestedView;
  return validViews.includes(lastView as AppView) ? (lastView as AppView) : "inicio";
}
