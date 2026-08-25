import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SoilTrend } from "./SoilTrend";
import type { SoilAnalysis } from "./soilStore";

function analise(id: string, date: string, values: SoilAnalysis["values"]): SoilAnalysis {
  return {
    id,
    plotId: "p1",
    analysisDate: date,
    laboratory: "Lab",
    source: "manual",
    createdAt: `${date}T00:00:00Z`,
    values,
  } as SoilAnalysis;
}

describe("SoilTrend", () => {
  it("não renderiza com menos de 2 laudos", () => {
    const { container } = render(<SoilTrend analyses={[analise("1", "2025-01-01", { vPercent: 40 })]} />);
    expect(container.firstChild).toBeNull();
  });

  it("mostra evolução e classifica V% subindo como bom", () => {
    render(
      <SoilTrend
        analyses={[
          analise("1", "2024-01-01", { vPercent: 40, mPercent: 20 }),
          analise("2", "2025-06-01", { vPercent: 60, mPercent: 8 }),
        ]}
      />,
    );
    expect(screen.getByText("Evolução do solo")).toBeInTheDocument();
    // V% 40→60 (+20) e m% 20→8 (−12) são melhoras → veredito positivo.
    expect(screen.getByText("Solo evoluindo bem")).toBeInTheDocument();
    expect(screen.getByText(/\+20/)).toBeInTheDocument();
  });
});
