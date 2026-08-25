import { ArrowRight, FlaskConical, Sprout, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import type { AppView } from "../../app/navigation";
import type { FarmPlot } from "../../domain/agriculturalContext";
import type { CenarioId } from "../../domain/fertilization";
import { parseNumberBR } from "../../domain/parseNumber";
import type { AgriculturalController } from "../../lib/useAgriculturalContext";
import type { NdviResult } from "../ndvi/types";
import type { SoilAnalysis } from "../soil/soilStore";
import { Fertility5aPanel } from "./Fertility5aPanel";
import "./fertilization.css";

/**
 * Calagem e adubação do café pela 5ª Aproximação de Minas Gerais (Emater-MG),
 * a partir do laudo do talhão. O Boletim 100 (IAC) foi removido desta tela — a
 * recomendação usa a base técnica da 5ª Aproximação.
 */

type FertilizationModuleProps = {
  agriculture: AgriculturalController;
  soilAnalyses: SoilAnalysis[];
  // Mantido por compatibilidade com quem chama o módulo (não usado aqui).
  ndviHistory?: NdviResult[];
  onNavigate: (view: AppView) => void;
};

function latestSoilForPlot(analyses: SoilAnalysis[], plotId: string): SoilAnalysis | null {
  const matches = analyses
    .filter((item) => item.plotId === plotId)
    .sort(
      (a, b) =>
        new Date(b.analysisDate ?? b.createdAt).getTime() -
        new Date(a.analysisDate ?? a.createdAt).getTime(),
    );
  return matches[0] ?? null;
}

// População efetiva (plantas/ha) a partir do cadastro do talhão: primeiro pelo
// espaçamento (10.000 / (linha × planta)); senão pela população total / área.
function plantasHaFromPlot(plot: FarmPlot): number | null {
  const linha = parseNumberBR(plot.rowSpacing);
  const planta = parseNumberBR(plot.plantSpacing);
  if (linha && planta && linha > 0 && planta > 0) {
    return Math.round(10000 / (linha * planta));
  }
  const pop = parseNumberBR(plot.population);
  if (pop && plot.areaHectares && plot.areaHectares > 0) {
    return Math.round(pop / plot.areaHectares);
  }
  return null;
}

function loadCenario(plotId?: string | null): CenarioId {
  if (!plotId || typeof localStorage === "undefined") return "media";
  try {
    const raw = localStorage.getItem(`agryn.fert5a.${plotId}`);
    if (raw === "baixa" || raw === "media" || raw === "alta") return raw;
  } catch {
    // sem persistência
  }
  return "media";
}

export function FertilizationModule({ agriculture, soilAnalyses, onNavigate }: FertilizationModuleProps) {
  const plot = agriculture.selectedPlot;
  // O componente remonta ao trocar de talhão (key no App), então o init reflete
  // o talhão atual.
  const [cenario, setCenario] = useState<CenarioId>(() => loadCenario(plot?.id));

  useEffect(() => {
    if (!plot) return;
    try {
      localStorage.setItem(`agryn.fert5a.${plot.id}`, cenario);
    } catch {
      // segue só em memória
    }
  }, [plot, cenario]);

  if (!plot) {
    return (
      <div className="page-stack platform-page">
        <header className="page-header">
          <div>
            <span className="eyebrow">Manejo nutricional</span>
            <h1>Calagem e adubação</h1>
          </div>
        </header>
        <section className="empty-state context-empty">
          <Sprout size={31} />
          <h2>Selecione um talhão</h2>
          <p>A recomendação é calculada para a área e o laudo de um talhão específico.</p>
          <button type="button" onClick={() => onNavigate("propriedades")}>
            Selecionar talhão
          </button>
        </section>
      </div>
    );
  }

  const soil = latestSoilForPlot(soilAnalyses, plot.id);

  return (
    <div className="page-stack platform-page">
      <header className="page-header context-page-header">
        <div>
          <span className="eyebrow">Manejo nutricional · 5ª Aproximação MG (Emater)</span>
          <h1>Calagem e adubação</h1>
          <p>
            Recomendação pela 5ª Aproximação de Minas Gerais a partir do laudo do talhão e da
            produção esperada.
          </p>
        </div>
        <button className="secondary-button" type="button" onClick={() => onNavigate("analise-solo")}>
          Ver laudo <ArrowRight size={17} />
        </button>
      </header>

      {!soil && (
        <section className="fert-warning">
          <TriangleAlert size={19} aria-hidden="true" />
          <div>
            <strong>Sem laudo de solo para {plot.name}</strong>
            <p>
              A recomendação pela 5ª Aproximação depende do laudo do talhão. Envie a foto ou o PDF
              para calcular.
            </p>
            <button type="button" onClick={() => onNavigate("analise-solo")}>
              <FlaskConical size={16} /> Enviar laudo
            </button>
          </div>
        </section>
      )}

      <Fertility5aPanel
        analysis={soil}
        plotName={plot.name}
        plotId={plot.id}
        plantasHa={plantasHaFromPlot(plot)}
        areaHa={plot.areaHectares ?? null}
        cenario={cenario}
        onCenarioChange={setCenario}
      />
    </div>
  );
}
