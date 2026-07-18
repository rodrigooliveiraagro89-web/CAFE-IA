export type ThemePreference = "light" | "dark";

export type Preferences = {
  theme: ThemePreference;
  lastView: string;
};

const STORAGE_KEY = "agryn:preferences:v2";
const DEFAULT_PREFERENCES: Preferences = { theme: "light", lastView: "inicio" };

export function loadPreferences(storage: Pick<Storage, "getItem"> = window.localStorage): Preferences {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      theme: parsed.theme === "dark" ? "dark" : "light",
      lastView: typeof parsed.lastView === "string" ? parsed.lastView : "inicio",
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(
  preferences: Preferences,
  storage: Pick<Storage, "setItem"> = window.localStorage,
): void {
  const safePayload: Preferences = {
    theme: preferences.theme === "dark" ? "dark" : "light",
    lastView: preferences.lastView,
  };
  storage.setItem(STORAGE_KEY, JSON.stringify(safePayload));
}
