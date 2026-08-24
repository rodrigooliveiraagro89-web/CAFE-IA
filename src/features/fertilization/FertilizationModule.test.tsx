import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FertilizationModule } from "./FertilizationModule";
import type { AgriculturalController } from "../../lib/useAgriculturalContext";
import type { FarmPlot } from "../../domain/agriculturalContext";
import type { SoilAnalysis } from "../soil/soilStore";

// Sem rede: o histórico salvo não é o foco destes testes.
vi.mock("./fert5aClient", () => ({
  listRecommendations: vi.fn(async () => []),
  saveRecommendation: vi.fn(async () => null),
}));

function plot(): FarmPlot {
  return {
    id: "plot-1",
    propertyId: "prop-1",
    name: "Casa 1",
    crop: "Café arábica",
    variety: "Catuaí",
    season: "2026/27",
    plantingDate: "",
    phenologicalStage: "",
    rowSpacing: "",
    plantSpacing: "",
    population: "",
    areaHectares: 2,
    geometry: null,
    createdAt: "2026-01-01T00:00:00Z",
  };
}

// Laudo Casa 1 (Profert): P 12 mg/dm³, K 100 mg/dm³, CTC 7 cmolc, Ca/Mg presentes.
function soil(): SoilAnalysis {
  return {
    id: "soil-1",
    plotId: "plot-1",
    analysisDate: "2026-06-19",
    laboratory: "Profert",
    source: "pdf",
    createdAt: "2026-06-19T00:00:00Z",
    values: { p: 12, k: 100, s: 6.4, ctc: 7, vPercent: 41, ca: 18, mg: 5 },
  } as SoilAnalysis;
}

function controller(selectedPlot: FarmPlot | null): AgriculturalController {
  return { selectedPlot, selectedProperty: null } as unknown as AgriculturalController;
}

function renderModule(withSoil = true) {
  return render(
    <FertilizationModule
      agriculture={controller(plot())}
      soilAnalyses={withSoil ? [soil()] : []}
      ndviHistory={[]}
      onNavigate={vi.fn()}
    />,
  );
}

describe("FertilizationModule (integração · 5ª Aproximação)", () => {
  beforeEach(() => window.localStorage.clear());

  it("mostra a recomendação da 5ª Aproximação a partir do laudo (sem Boletim 100)", () => {
    renderModule();
    // Cabeçalho da tela.
    expect(screen.getByRole("heading", { name: "Calagem e adubação" })).toBeInTheDocument();
    // Painel da 5ª Aproximação com o nome do talhão.
    expect(screen.getByRole("heading", { name: /Recomendação de nutrientes · Casa 1/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Necessidade de nutrientes/i })).toBeInTheDocument();
    // Correção do solo: calagem calculada (V% baixo).
    expect(screen.getByText(/t\/ha \(produto\)/i)).toBeInTheDocument();
    // Fonte técnica: 5ª Aproximação (não Boletim 100).
    expect(screen.getAllByText(/5ª Aproximação de Minas Gerais/i).length).toBeGreaterThan(0);
    // Não deve existir mais o antigo Boletim 100.
    expect(screen.queryByRole("heading", { name: "Adubação NPK" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Boletim 100/i)).not.toBeInTheDocument();
  });

  it("permite escolher a produção e guarda o cenário do talhão", async () => {
    const user = userEvent.setup();
    renderModule();
    await user.click(screen.getByRole("button", { name: /Alta\s*70 sc\/ha/i }));
    expect(window.localStorage.getItem("agryn.fert5a.plot-1")).toBe("alta");
  });

  it("sem laudo, avisa e pede o envio da análise (não calcula por suposição)", () => {
    renderModule(false);
    expect(screen.getByText(/Sem laudo de solo/i)).toBeInTheDocument();
    expect(screen.getByText(/Envie a análise de solo do talhão/i)).toBeInTheDocument();
    // Nada de NPK do Boletim 100.
    expect(screen.queryByRole("heading", { name: "Adubação NPK" })).not.toBeInTheDocument();
  });
});
