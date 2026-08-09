import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./lib/localDataSnapshot";
import "@fontsource-variable/inter/index.css";
import "@fontsource-variable/orbitron/index.css";
import "leaflet/dist/leaflet.css";
import { App } from "./app/App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./styles/index.css";
import "./styles/platform.css";

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
