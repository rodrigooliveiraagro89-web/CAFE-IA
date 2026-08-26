import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./lib/localDataSnapshot";
import "@fontsource-variable/inter/index.css";
import "@fontsource-variable/orbitron/index.css";
import "leaflet/dist/leaflet.css";
import { App } from "./app/App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { initTelemetry } from "./lib/telemetry";
import { initOutbox } from "./lib/syncOutbox";
import "./styles/index.css";
import "./styles/platform.css";

initTelemetry();
// Reenvia escritas offline (solo/NDVI) quando a conexão voltar (Fase 1.3).
initOutbox();

// Depois que o app fica de pé por alguns segundos, libera nova auto-recarga
// para um futuro chunk obsoleto (o flag é setado em retryImport no App.tsx).
// O atraso evita laço: se o index novo também falhar logo, o flag segue setado.
setTimeout(() => {
  try {
    sessionStorage.removeItem("agryn:chunk-reload");
  } catch {
    /* ambiente sem sessionStorage */
  }
}, 5000);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary label="o AGRYN">
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
  });
}
