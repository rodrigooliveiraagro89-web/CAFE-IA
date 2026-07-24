import { useState } from "react";
import { ArrowRight, Calculator, Droplets, Ruler, Sprout } from "lucide-react";
import type { AppView } from "../../app/navigation";
import {
  calcularEspacamento,
  calcularPulverizacao,
  converterArea,
} from "../../domain/calculators";
import type { AgriculturalController } from "../../lib/useAgriculturalContext";
import "./calculators.css";

type CalculatorsModuleProps = {
  agriculture: AgriculturalController;
  onNavigate: (view: AppView) => void;
};

const nf = (value: number, digits = 2) =>
  value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function CalculatorsModule({ agriculture, onNavigate }: CalculatorsModuleProps) {
  // A área do talhão selecionado entra como padrão: menos digitação no campo e
  // resultado já contextualizado na área real do produtor.
  const areaTalhao = agriculture.selectedPlot?.areaHectares ?? 1;

  const [espac, setEspac] = useState({
    entreLinhas: 3.5,
    entrePlantas: 0.7,
    area: areaTalhao,
    dose: 400,
  });
  const [spray, setSpray] = useState({
    volumeCalda: 400,
    tanque: 2000,
    dose: 2,
    area: areaTalhao,
  });
  const [areaHa, setAreaHa] = useState(areaTalhao);

  const espacResult = calcularEspacamento(espac);
  const sprayResult = calcularPulverizacao(spray);
  const convResult = converterArea(areaHa);

  return (
    <div className="page-stack platform-page">
      <header className="page-header context-page-header">
        <div>
          <span className="eyebrow">Ferramentas de campo</span>
          <h1>Calculadoras</h1>
          <p>
            Estande, pulverização e conversão de área. Os valores não são salvos — servem
            para dimensionar a operação na hora.
          </p>
        </div>
        <button className="secondary-button" type="button" onClick={() => onNavigate("modulos")}>
          Ver módulos <ArrowRight size={17} />
        </button>
      </header>

      {agriculture.selectedPlot && (
        <p className="calc-context">
          Área preenchida a partir do talhão <strong>{agriculture.selectedPlot.name}</strong> (
          {nf(areaTalhao, 2)} ha). Você pode alterar para simular outra situação.
        </p>
      )}

      <section className="panel-card">
        <div className="panel-title">
          <Sprout size={21} />
          <div>
            <span className="eyebrow">Espaçamento</span>
            <h2>Densidade de plantio e produto por hectare</h2>
          </div>
        </div>

        <div className="calc-grid">
          <label>
            Entre linhas (m)
            <input
              type="number"
              step="0.1"
              inputMode="decimal"
              value={espac.entreLinhas}
              onChange={(event) => setEspac({ ...espac, entreLinhas: Number(event.target.value) })}
            />
          </label>
          <label>
            Entre plantas (m)
            <input
              type="number"
              step="0.1"
              inputMode="decimal"
              value={espac.entrePlantas}
              onChange={(event) => setEspac({ ...espac, entrePlantas: Number(event.target.value) })}
            />
          </label>
          <label>
            Área (ha)
            <input
              type="number"
              step="0.1"
              inputMode="decimal"
              value={espac.area}
              onChange={(event) => setEspac({ ...espac, area: Number(event.target.value) })}
            />
          </label>
          <label>
            Dose (g ou mL por ha)
            <input
              type="number"
              inputMode="decimal"
              value={espac.dose}
              onChange={(event) => setEspac({ ...espac, dose: Number(event.target.value) })}
            />
          </label>
        </div>

        <div className="calc-results">
          <div>
            <span>Plantas/ha</span>
            <strong>{espacResult.plantasPorHa > 0 ? nf(espacResult.plantasPorHa, 0) : "—"}</strong>
          </div>
          <div>
            <span>Produto/planta</span>
            <strong>
              {espacResult.produtoPorPlanta !== null ? nf(espacResult.produtoPorPlanta, 3) : "—"}
            </strong>
            <small>na unidade da dose</small>
          </div>
          <div>
            <span>Total na área</span>
            <strong>{nf(espacResult.totalProduto, 2)}</strong>
            <small>kg ou L</small>
          </div>
        </div>
      </section>

      <section className="panel-card">
        <div className="panel-title">
          <Droplets size={21} />
          <div>
            <span className="eyebrow">Pulverização</span>
            <h2>Calda, produto e número de tanques</h2>
          </div>
        </div>

        <div className="calc-grid">
          <label>
            Volume de calda (L/ha)
            <input
              type="number"
              inputMode="decimal"
              value={spray.volumeCalda}
              onChange={(event) => setSpray({ ...spray, volumeCalda: Number(event.target.value) })}
            />
          </label>
          <label>
            Capacidade do tanque (L)
            <input
              type="number"
              inputMode="decimal"
              value={spray.tanque}
              onChange={(event) => setSpray({ ...spray, tanque: Number(event.target.value) })}
            />
          </label>
          <label>
            Dose (mL ou g por L de calda)
            <input
              type="number"
              step="0.1"
              inputMode="decimal"
              value={spray.dose}
              onChange={(event) => setSpray({ ...spray, dose: Number(event.target.value) })}
            />
          </label>
          <label>
            Área (ha)
            <input
              type="number"
              step="0.1"
              inputMode="decimal"
              value={spray.area}
              onChange={(event) => setSpray({ ...spray, area: Number(event.target.value) })}
            />
          </label>
        </div>

        <div className="calc-results">
          <div>
            <span>Água total</span>
            <strong>{nf(sprayResult.litrosAguaTotal, 0)}</strong>
            <small>litros</small>
          </div>
          <div>
            <span>Produto total</span>
            <strong>{nf(sprayResult.produtoTotal, 2)}</strong>
            <small>kg ou L</small>
          </div>
          <div>
            <span>Nº de tanques</span>
            <strong>{sprayResult.numeroTanques > 0 ? sprayResult.numeroTanques : "—"}</strong>
            <small>abastecimentos</small>
          </div>
        </div>
      </section>

      <section className="panel-card">
        <div className="panel-title">
          <Ruler size={21} />
          <div>
            <span className="eyebrow">Conversão</span>
            <h2>Área em outras unidades</h2>
          </div>
        </div>

        <div className="calc-grid calc-grid-single">
          <label>
            Área (ha)
            <input
              type="number"
              step="0.1"
              inputMode="decimal"
              value={areaHa}
              onChange={(event) => setAreaHa(Number(event.target.value))}
            />
          </label>
        </div>

        <div className="calc-results">
          <div>
            <span>Metros quadrados</span>
            <strong>{nf(convResult.metrosQuadrados, 0)}</strong>
            <small>m²</small>
          </div>
          <div>
            <span>Alqueire paulista</span>
            <strong>{nf(convResult.alqueirePaulista, 3)}</strong>
            <small>2,42 ha cada</small>
          </div>
          <div>
            <span>Alqueire mineiro</span>
            <strong>{nf(convResult.alqueireMineiro, 3)}</strong>
            <small>4,84 ha cada</small>
          </div>
        </div>
      </section>

      <p className="calc-note">
        <Calculator size={15} aria-hidden="true" /> Resultados matemáticos a partir do que você
        informou. Não substituem a recomendação técnica de um agrônomo responsável.
      </p>
    </div>
  );
}
