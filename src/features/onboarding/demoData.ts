import type { FarmPlot, FarmProperty } from "../../domain/agriculturalContext";
import type { SoilAnalysis } from "../soil/soilStore";

/**
 * Modo demonstração — dados FICTÍCIOS para o novo usuário ver o app funcionando
 * em 30s, sem precisar cadastrar nada. Marcados com ownerId "demo" e ids com
 * prefixo "demo-"; os stores têm guardas para NUNCA sincronizar isto com a
 * nuvem. Baseado num laudo real de café (Sul de Minas), com o nome trocado.
 */

export const DEMO_OWNER = "demo";
export const DEMO_FLAG = "agryn.demo-mode";
export const DEMO_EVENT = "agryn:demo-changed";

export function isDemoActive(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(DEMO_FLAG) === "1";
  } catch {
    return false;
  }
}

export function setDemoActive(on: boolean): void {
  try {
    if (on) localStorage.setItem(DEMO_FLAG, "1");
    else localStorage.removeItem(DEMO_FLAG);
  } catch {
    // sem persistência: só nesta sessão
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(DEMO_EVENT));
}

export const demoProperty: FarmProperty = {
  id: "demo-prop",
  name: "Fazenda Modelo (exemplo)",
  producer: "Produtor Demonstração",
  responsible: "Agrônomo(a) responsável",
  city: "Ouro Fino",
  state: "MG",
  createdAt: "2026-01-10T00:00:00Z",
  ownerId: DEMO_OWNER,
};

function plot(id: string, name: string): FarmPlot {
  return {
    id,
    propertyId: demoProperty.id,
    name,
    crop: "Café arábica",
    variety: "Catuaí Vermelho",
    season: "2026/27",
    plantingDate: "",
    phenologicalStage: "Granação",
    rowSpacing: "3,5 m",
    plantSpacing: "0,7 m",
    population: "4082",
    areaHectares: 3.2,
    geometry: null,
    createdAt: "2026-01-10T00:00:00Z",
  };
}

export const demoPlots: FarmPlot[] = [
  plot("demo-casa1", "Casa 1"),
  plot("demo-casa2", "Casa 2"),
  plot("demo-pinheiro1", "Pinheiro 1"),
  plot("demo-pinheiro2", "Pinheiro 2"),
];

// Valores no padrão do app: k em mg/dm³; ca/mg em mmolc/dm³; ctc em cmolc/dm³;
// p em mg/dm³; vPercent em %. (Equivalem ao laudo Profert convertido.)
function soil(plotId: string, values: SoilAnalysis["values"]): SoilAnalysis {
  return {
    id: `demo-soil-${plotId}`,
    plotId,
    analysisDate: "2026-06-19",
    laboratory: "Laboratório Exemplo",
    source: "pdf",
    createdAt: "2026-06-19T00:00:00Z",
    values,
  };
}

export const demoSoil: SoilAnalysis[] = [
  soil("demo-casa1", { ph: 4.66, organicMatter: 2.04, p: 12.0, k: 231, ca: 18, mg: 5, s: 6.4, ctc: 7.0, vPercent: 41.4, b: 0.23, zn: 1.8, cu: 0.6, fe: 44, mn: 7.2 }),
  soil("demo-casa2", { ph: 4.86, organicMatter: 1.8, p: 12.3, k: 238, ca: 21, mg: 6, s: 6.7, ctc: 6.7, vPercent: 49.4, b: 0.24, zn: 2.5, cu: 0.5, fe: 29, mn: 17.7 }),
  soil("demo-pinheiro1", { ph: 5.51, organicMatter: 1.78, p: 6.9, k: 160, ca: 29, mg: 9, s: 13.0, ctc: 6.5, vPercent: 64.9, b: 0.12, zn: 2.9, cu: 0.5, fe: 40, mn: 26.6 }),
  soil("demo-pinheiro2", { ph: 5.67, organicMatter: 2.11, p: 8.3, k: 172, ca: 38, mg: 11, s: 1.5, ctc: 7.4, vPercent: 71.9, b: 0.09, zn: 3.6, cu: 0.6, fe: 28, mn: 24.1 }),
];
