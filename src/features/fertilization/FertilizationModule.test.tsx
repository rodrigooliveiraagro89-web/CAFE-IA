import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FertilizationModule } from "./FertilizationModule";
import type { AgriculturalController } from "../../lib/useAgriculturalContext";
import type { FarmPlot } from "../../domain/agriculturalContext";
import type { SoilAnalysis } from "../soil/soilStore";

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

// Laudo Casa 1 (Profert): P 12 mg/dm³, K 100 mg/dm³, CTC 7 cmolc, V% 41.
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

describe("FertilizationModule (integração)", () => {
  beforeEach(() => window.localStorage.clear());

  it("mostra calagem, NPK, programa recomendado e custo a partir do laudo", () => {
    renderModule();
    // Calagem para elevar V% 41 -> 60 (não dispensada).
    expect(screen.getByText(/Calcário dolomítico/i)).toBeInTheDocument();
    // NPK do Boletim 100.
    expect(screen.getByRole("heading", { name: "Adubação NPK" })).toBeInTheDocument();
    // Programa: fórmula recomendada 27-00-10 aparece na tabela.
    expect(screen.getAllByText(/27-00-10/).length).toBeGreaterThan(0);
    // Custo por saca presente.
    expect(screen.getByRole("heading", { name: /Quanto custa a adubação/i })).toBeInTheDocument();
    expect(screen.getAllByText(/\/sc|\/ha/).length).toBeGreaterThan(0);
  });

  it("avisa potássio em excesso ao escolher 20-00-20 (solo com K alto)", async () => {
    const user = userEvent.setup();
    renderModule();
    expect(screen.queryByText(/Potássio em excesso/i)).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/Fórmula de cobertura/i), "200020");
    expect(screen.getByText(/Potássio em excesso/i)).toBeInTheDocument();
  });

  it("recalcula o alvo de V% pelo slider e reflete na proveniência", () => {
    renderModule();
    const slider = screen.getByLabelText("Alvo de V%");
    // Sobe o alvo para 70% — a proveniência passa a citar V% alvo 70.
    fireChange(slider, "70");
    const prov = screen.getByRole("heading", { name: /Proveniência da recomendação/i }).closest("section");
    expect(prov).not.toBeNull();
    expect(within(prov as HTMLElement).getAllByText(/V% alvo 70/).length).toBeGreaterThan(0);
  });

  it("registra a proveniência com o laudo de origem (lab e data)", () => {
    renderModule();
    const prov = screen.getByRole("heading", { name: /Proveniência da recomendação/i }).closest("section") as HTMLElement;
    expect(within(prov).getAllByText(/Profert/).length).toBeGreaterThan(0);
    expect(within(prov).getAllByText(/19\/06\/2026/).length).toBeGreaterThan(0);
    expect(within(prov).getAllByText(/b100\./).length).toBeGreaterThan(0);
  });

  it("sem laudo, avisa e ainda calcula pelas classes médias", () => {
    renderModule(false);
    expect(screen.getByText(/Sem laudo de solo/i)).toBeInTheDocument();
    // NPK ainda é calculado (com suposições).
    expect(screen.getByRole("heading", { name: "Adubação NPK" })).toBeInTheDocument();
    expect(screen.getByText(/Suposições feitas por falta de dado/i)).toBeInTheDocument();
  });
});

function fireChange(element: HTMLElement, value: string) {
  const input = element as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
