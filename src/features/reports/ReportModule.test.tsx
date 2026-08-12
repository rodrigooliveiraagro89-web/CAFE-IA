import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReportModule } from "./ReportModule";
import type { AgriculturalController } from "../../lib/useAgriculturalContext";
import type { FarmPlot, FarmProperty } from "../../domain/agriculturalContext";
import type { SoilAnalysis } from "../soil/soilStore";

function property(): FarmProperty {
  return {
    id: "prop-1",
    name: "Sítio São José",
    producer: "Eduardo Caetano",
    responsible: "Rodrigo Oliveira",
    city: "Bueno Brandão",
    state: "MG",
    createdAt: "2026-01-01T00:00:00Z",
  };
}

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

function controller(): AgriculturalController {
  const prop = property();
  const pl = plot();
  return {
    selectedProperty: prop,
    selectedPlot: pl,
    state: {
      properties: [prop],
      plots: [pl],
      selectedPropertyId: prop.id,
      selectedPlotId: pl.id,
    },
  } as unknown as AgriculturalController;
}

describe("ReportModule (integração)", () => {
  beforeEach(() => window.localStorage.clear());

  it("inclui a seção de adubação com programa e proveniência (plano Pro)", () => {
    render(
      <ReportModule
        agriculture={controller()}
        records={[]}
        ndviHistory={[]}
        soilAnalyses={[soil()]}
        planId="pro"
        trialAvailable={false}
        onStartTrial={vi.fn()}
        onSubscribe={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Adubação recomendada" })).toBeInTheDocument();
    // Programa com a fórmula recomendada e a proveniência (base + laudo).
    expect(screen.getAllByText(/27-00-10/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Base:.*Boletim 100.*Profert/)).toBeInTheDocument();
  });

  it("no plano grátis, mostra o aviso de upgrade em vez do relatório", () => {
    render(
      <ReportModule
        agriculture={controller()}
        records={[]}
        ndviHistory={[]}
        soilAnalyses={[soil()]}
        planId="gratis"
        trialAvailable={true}
        onStartTrial={vi.fn()}
        onSubscribe={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    expect(screen.queryByRole("heading", { name: "Adubação recomendada" })).not.toBeInTheDocument();
  });
});
