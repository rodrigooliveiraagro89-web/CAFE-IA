import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/AppShell";
import { evaluateRecommendationReadiness } from "../domain/safety";
import { Dashboard } from "../features/dashboard/Dashboard";
import { ModuleHub } from "../features/modules/ModuleHub";
import { SafetyCenter } from "../features/safety/SafetyCenter";
import { loadPreferences, savePreferences, type ThemePreference } from "../lib/preferences";
import type { AppView } from "./navigation";

const validViews: AppView[] = ["inicio", "modulos", "seguranca"];

export function App() {
  const initialPreferences = useMemo(() => loadPreferences(), []);
  const [activeView, setActiveView] = useState<AppView>(
    validViews.includes(initialPreferences.lastView as AppView)
      ? (initialPreferences.lastView as AppView)
      : "inicio",
  );
  const [theme, setTheme] = useState<ThemePreference>(initialPreferences.theme);
  const safety = useMemo(() => evaluateRecommendationReadiness(), []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    savePreferences({ theme, lastView: activeView });
  }, [activeView, theme]);

  return (
    <AppShell
      activeView={activeView}
      onNavigate={setActiveView}
      theme={theme}
      onToggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
    >
      {activeView === "inicio" && <Dashboard safety={safety} onNavigate={setActiveView} />}
      {activeView === "modulos" && <ModuleHub />}
      {activeView === "seguranca" && <SafetyCenter safety={safety} />}
    </AppShell>
  );
}
