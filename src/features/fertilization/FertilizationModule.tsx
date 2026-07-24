import { useState } from "react";
import {
  ArrowRight,
  Download,
  FlaskConical,
  Info,
  Layers,
  Mountain,
  Sprout,
  TriangleAlert,
} from "lucide-react";
import type { AppView } from "../../app/navigation";
import {
  CENARIOS,
  calcularCalagem,
  recomendarAdubacao,
  sacasParaKgHa,
  type CenarioId,
} from "../../domain/fertilization";
import { gramasPorPlanta } from "../../domain/calculators";
import {
  VR_LIMITACAO_GEO,
  ZONA_EXCLUIDA_NOTA,
  construirPrescricaoVR,
  prescricaoParaCsv,
} from "../../domain/variableRate";
import type { AgriculturalController } from "../../lib/useAgriculturalContext";
import { buildManagementZones } from "../ndvi/managementZones";
import type { NdviResult } from "../ndvi/types";
import type { SoilAnalysis } from "../soil/soilStore";
import "./fertilization.css";

type FertilizationModuleProps = {
  agriculture: AgriculturalController;
  soilAnalyses: SoilAnalysis[];
  ndviHistory: NdviResult[];
  onNavigate: (view: AppView) => void;
};

function latestNdviForPlot(history: NdviResult[], plotId: string): NdviResult | null {
  const matches = history
    .filter((item) => item.plotId === plotId)
    .sort((a, b) => new Date(b.acquiredAt).getTime() - new Date(a.acquiredAt).getTime());
  return matches[0] ?? null;
}

function baixarCsv(conteudo: string, nomeArquivo: string) {
  const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  link.click();
  URL.revokeObjectURL(url);
}

const nf = (value: number, digits = 0) =>
  value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

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

export function FertilizationModule({
  agriculture,
  soilAnalyses,
  ndviHistory,
  onNavigate,
}: FertilizationModuleProps) {
  const [cenarioId, setCenarioId] = useState<CenarioId>("media");
  const [plantasPorHa, setPlantasPorHa] = useState(4082);

  const plot = agriculture.selectedPlot;
  const soil = plot ? latestSoilForPlot(soilAnalyses, plot.id) : null;
  const cenario = CENARIOS.find((item) => item.id === cenarioId) ?? CENARIOS[1];

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

  const values = soil?.values ?? {};
  const produtividadeKgHa = sacasParaKgHa(cenario.sacasPorHectare);

  const calagem =
    values.ctc !== null && values.ctc !== undefined &&
    values.vPercent !== null && values.vPercent !== undefined
      ? calcularCalagem({ ctcCmolc: values.ctc, vAtual: values.vPercent })
      : null;

  const adubacao = recomendarAdubacao({
    produtividadeKgHa,
    pResina: values.p,
    kMgPorDm3: values.k,
    sMgPorDm3: values.s,
  });

  const totalCalcario = calagem ? calagem.toneladasPorHectare * plot.areaHectares : 0;

  const nutrientes = [
    { label: "Nitrogênio (N)", value: adubacao.n },
    { label: "Fósforo (P₂O₅)", value: adubacao.p2o5 },
    { label: "Potássio (K₂O)", value: adubacao.k2o },
    { label: "Enxofre (S)", value: adubacao.s },
  ];

  return (
    <div className="page-stack platform-page">
      <header className="page-header context-page-header">
        <div>
          <span className="eyebrow">Manejo nutricional · Boletim 100 (IAC)</span>
          <h1>Calagem e adubação</h1>
          <p>
            Doses calculadas por tabela oficial a partir do laudo de solo e da produtividade
            esperada. Café em produção (a partir do 3º ano).
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
              As doses abaixo usam as classes médias do Boletim 100. Envie o laudo para uma
              recomendação baseada no seu solo.
            </p>
            <button type="button" onClick={() => onNavigate("analise-solo")}>
              <FlaskConical size={16} /> Enviar laudo
            </button>
          </div>
        </section>
      )}

      <section className="panel-card">
        <div className="panel-title">
          <Sprout size={21} />
          <div>
            <span className="eyebrow">{plot.name} · {nf(plot.areaHectares, 2)} ha</span>
            <h2>Produtividade esperada</h2>
          </div>
        </div>

        <div className="fert-scenarios" role="group" aria-label="Cenário de produtividade">
          {CENARIOS.map((item) => (
            <button
              key={item.id}
              type="button"
              data-active={item.id === cenarioId}
              onClick={() => setCenarioId(item.id)}
            >
              <strong>{item.label}</strong>
              <span>{item.sacasPorHectare} sc/ha</span>
            </button>
          ))}
        </div>
        <p className="fert-hint">
          {nf(produtividadeKgHa)} kg/ha de café beneficiado. Na dúvida, o Boletim 100 orienta
          errar um pouco para mais — faltar adubo em ano bom custa mais caro.
        </p>
      </section>

      <section className="panel-card">
        <div className="panel-title">
          <Mountain size={21} />
          <div>
            <span className="eyebrow">Correção</span>
            <h2>Calagem</h2>
          </div>
        </div>

        {!calagem ? (
          <p className="fert-empty">
            Precisa de <strong>CTC</strong> e <strong>V%</strong> no laudo para calcular a
            necessidade de calcário.
          </p>
        ) : calagem.dispensada ? (
          <p className="fert-ok">
            V% atual de {nf(calagem.vAtual, 1)}% já atingiu o alvo de {calagem.vAlvo}% —
            calagem dispensada nesta safra.
          </p>
        ) : (
          <>
            <div className="calc-results">
              <div>
                <span>Calcário dolomítico</span>
                <strong>{nf(calagem.toneladasPorHectare, 2)}</strong>
                <small>t/ha (PRNT {calagem.prnt}%)</small>
              </div>
              <div>
                <span>Total no talhão</span>
                <strong>{nf(totalCalcario, 2)}</strong>
                <small>toneladas</small>
              </div>
              <div>
                <span>Saturação por bases</span>
                <strong>{nf(calagem.vAtual, 1)}% → {calagem.vAlvo}%</strong>
                <small>V% atual → alvo</small>
              </div>
            </div>
            <p className="fert-hint">
              Aplicar a lanço na entrelinha, idealmente 60–90 dias antes da adubação, para dar
              tempo de reação no solo.
            </p>
          </>
        )}
      </section>

      <section className="panel-card">
        <div className="panel-title">
          <FlaskConical size={21} />
          <div>
            <span className="eyebrow">Boletim 100</span>
            <h2>Adubação NPK</h2>
          </div>
        </div>

        <div className="fert-npk">
          {nutrientes.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{nf(item.value)}</strong>
              <small>kg/ha</small>
              {plantasPorHa > 0 && item.value > 0 && (
                <em>{nf(gramasPorPlanta(item.value, plantasPorHa) ?? 0, 1)} g/planta</em>
              )}
            </div>
          ))}
        </div>

        <label className="fert-stand">
          Plantas por hectare (para o cálculo de g/planta)
          <input
            type="number"
            inputMode="numeric"
            value={plantasPorHa}
            onChange={(event) => setPlantasPorHa(Number(event.target.value))}
          />
        </label>

        <p className="fert-hint">
          Parcele N e K em 3 a 4 aplicações ao longo das águas (out/nov → fev/mar). P e calagem
          podem ir de uma vez.
        </p>

        {adubacao.suposicoes.length > 0 && (
          <div className="fert-assumptions">
            <Info size={16} aria-hidden="true" />
            <div>
              <strong>Suposições feitas por falta de dado</strong>
              <ul>
                {adubacao.suposicoes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>

      {(() => {
        const ndvi = latestNdviForPlot(ndviHistory, plot.id);
        const zonas = ndvi ? buildManagementZones(ndvi).filter((z) => z.hectares > 0) : [];

        if (!soil || zonas.length === 0) {
          return (
            <section className="panel-card">
              <div className="panel-title">
                <Layers size={21} />
                <div>
                  <span className="eyebrow">Taxa variável</span>
                  <h2>Prescrição por zona</h2>
                </div>
              </div>
              <p className="fert-empty">
                Precisa de <strong>laudo de solo</strong> e de um{" "}
                <strong>processamento de NDVI</strong> neste talhão para modular a dose por
                zona.{" "}
                {!ndvi && (
                  <button
                    type="button"
                    className="ndvi-inline-link"
                    onClick={() => onNavigate("ndvi")}
                  >
                    Processar NDVI
                  </button>
                )}
              </p>
            </section>
          );
        }

        const prescricao = construirPrescricaoVR(zonas, {
          n: adubacao.n,
          p2o5: adubacao.p2o5,
          k2o: adubacao.k2o,
        });

        return (
          <section className="panel-card">
            <div className="panel-title">
              <Layers size={21} />
              <div>
                <span className="eyebrow">Taxa variável · zonas do NDVI</span>
                <h2>Prescrição por zona</h2>
              </div>
            </div>

            <div className="vr-table-wrap">
              <table className="vr-table">
                <thead>
                  <tr>
                    <th>Zona</th>
                    <th>Área</th>
                    <th>Fator</th>
                    <th>N</th>
                    <th>P₂O₅</th>
                    <th>K₂O</th>
                  </tr>
                </thead>
                <tbody>
                  {prescricao.zonas.map((zona) => (
                    <tr key={zona.letter} data-excluida={zona.excluida || undefined}>
                      <td>
                        <span className="vr-dot" style={{ background: zona.color }} />
                        {zona.letter} · {zona.label}
                      </td>
                      <td>{nf(zona.hectares, 2)} ha</td>
                      <td>{zona.excluida ? "—" : `${nf(zona.fator, 2)}×`}</td>
                      <td>{zona.excluida ? "não adubar" : `${nf(zona.dosePorHectare.n)} kg/ha`}</td>
                      <td>{zona.excluida ? "—" : `${nf(zona.dosePorHectare.p2o5)} kg/ha`}</td>
                      <td>{zona.excluida ? "—" : `${nf(zona.dosePorHectare.k2o)} kg/ha`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="calc-results">
              <div>
                <span>Total a taxa variável</span>
                <strong>{nf(prescricao.totalVariavel.n)}</strong>
                <small>kg de N ({nf(prescricao.hectaresAdubados, 2)} ha adubados)</small>
              </div>
              <div>
                <span>Se fosse dose única</span>
                <strong>{nf(prescricao.totalUniforme.n)}</strong>
                <small>kg de N em {nf(prescricao.hectaresTotais, 2)} ha</small>
              </div>
              <div>
                <span>{prescricao.economia.n >= 0 ? "Economia de N" : "Acréscimo de N"}</span>
                <strong>{nf(Math.abs(prescricao.economia.n))}</strong>
                <small>kg</small>
              </div>
            </div>

            <button
              type="button"
              className="secondary-button vr-export"
              onClick={() =>
                baixarCsv(
                  prescricaoParaCsv(prescricao),
                  `prescricao-vr-${plot.name.replace(/\s+/g, "-").toLowerCase()}.csv`,
                )
              }
            >
              <Download size={17} /> Baixar CSV da prescrição
            </button>

            <div className="fert-assumptions">
              <Info size={16} aria-hidden="true" />
              <div>
                <strong>Leia antes de aplicar</strong>
                <ul>
                  <li>{ZONA_EXCLUIDA_NOTA}</li>
                  <li>{VR_LIMITACAO_GEO}</li>
                </ul>
              </div>
            </div>
          </section>
        );
      })()}

      <p className="fert-disclaimer">
        Cálculo determinístico a partir das tabelas do Boletim 100 (IAC) e do laudo informado.
        Não substitui a visita e a assinatura do engenheiro agrônomo responsável, que deve
        validar a recomendação considerando histórico, textura do solo e condições da lavoura.
      </p>
    </div>
  );
}
