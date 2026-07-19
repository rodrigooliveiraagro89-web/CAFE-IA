import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./lib/localDataSnapshot";
import "@fontsource-variable/inter/index.css";
import "@fontsource-variable/orbitron/index.css";
import "leaflet/dist/leaflet.css";
import { App } from "./app/App";
import "./styles/index.css";
import "./styles/platform.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
