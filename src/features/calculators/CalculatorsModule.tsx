import { useState } from "react";
import { ArrowRight, Calculator, Droplets, Ruler, Sprout } from "lucide-react";
import type { AppView } from "../../app/navigation";
import {
  calcularEspacamento,
  calcularPulverizacao,
  converterArea,
} from "../../domain/calculators";
import { parseNumberBR } from "../../domain/parseNumber";
import type { AgriculturalController } from "../../lib/useAgriculturalContext";
import "./calculators.css";

type CalculatorsModuleProps = {
  agriculture: AgriculturalController;
  onNavigate: (view: AppView) => void;
};

const nf = (value: number, digits = 2) =>
  value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

// Campo numérico tolerante ao formato brasileiro: aceita vírgula ou ponto e
// avisa quando o texto não é um número — em vez de virar 0 silencioso e sair
// numa dose errada.
function NumField({
  label,
  value,
  onChange,
  step,
  hint,
}: {
  label: string;
  value: string;
  onChange: (raw: string) => void;
  step?: string;
  hint?: string;
}) {
  const invalido = value.trim() !== "" && parseNumberBR(value) === null;
  return (
    <label>
      {label}
      <input
        type="text"
        inputMode="decimal"
        step={step}
        value={value}
        aria-invalid={invalido}
        onChange={(event) => onChange(event.target.value)}
      />
      {invalido ? (
        <small className="field-invalid">Use apenas números (ex.: 3,5)</small>
      ) : hint ? (
        <small>{hint}</small>
      ) : null}
    </label>
  );
}

export function CalculatorsModule({ agriculture, onNavigate }: CalculatorsModuleProps) {
  // A área do talhão selecionado entra como padrão: menos digitação no campo e
  // resultado já contextualizado na área real do produtor.
  const areaTalhao = agriculture.selectedPlot?.areaHectares ?? 1;
  const areaPadrao = String(areaTalhao);

  const [espac, setEspac] = useState({
    entreLinhas: "3,5",
    entrePlantas: "0,7",
    area: areaPadrao,
    dose: "400",
  });
  const [spray, setSpray] = useState({
    volumeCalda: "400",
    tanque: "2000",
    dose: "2",
    area: areaPadrao,
  });
  const [areaHa, setAreaHa] = useState(areaPadrao);

  // Parse tolerante; null (vazio/inválido) vira 0 no cálculo e os resultados já
  // exibem "—" nesse caso — nunca um número enganoso.
  const espacResult = calcularEspacamento({
    entreLinhas: parseNumberBR(espac.entreLinhas) ?? 0,
    entrePlantas: parseNumberBR(espac.entrePlantas) ?? 0,
    area: parseNumberBR(espac.area) ?? 0,
    dose: parseNumberBR(espac.dose) ?? 0,
  });
  const sprayResult = calcularPulverizacao({
    volumeCalda: parseNumberBR(spray.volumeCalda) ?? 0,
    tanque: parseNumberBR(spray.tanque) ?? 0,
    dose: parseNumberBR(spray.dose) ?? 0,
    area: parseNumberBR(spray.area) ?? 0,
  });
  const convResult = converterArea(parseNumberBR(areaHa) ?? 0);

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
          <NumField
            label="Entre linhas (m)"
            step="0.1"
            value={espac.entreLinhas}
            onChange={(raw) => setEspac({ ...espac, entreLinhas: raw })}
          />
          <NumField
            label="Entre plantas (m)"
            step="0.1"
            value={espac.entrePlantas}
            onChange={(raw) => setEspac({ ...espac, entrePlantas: raw })}
          />
          <NumField
            label="Área (ha)"
            step="0.1"
            value={espac.area}
            onChange={(raw) => setEspac({ ...espac, area: raw })}
          />
          <NumField
            label="Dose (g ou mL por ha)"
            value={espac.dose}
            onChange={(raw) => setEspac({ ...espac, dose: raw })}
          />
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
            <strong>{espacResult.totalProduto > 0 ? nf(espacResult.totalProduto, 2) : "—"}</strong>
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
          <NumField
            label="Volume de calda (L/ha)"
            value={spray.volumeCalda}
            onChange={(raw) => setSpray({ ...spray, volumeCalda: raw })}
          />
          <NumField
            label="Capacidade do tanque (L)"
            value={spray.tanque}
            onChange={(raw) => setSpray({ ...spray, tanque: raw })}
          />
          <NumField
            label="Dose (mL ou g por L de calda)"
            step="0.1"
            value={spray.dose}
            onChange={(raw) => setSpray({ ...spray, dose: raw })}
          />
          <NumField
            label="Área (ha)"
            step="0.1"
            value={spray.area}
            onChange={(raw) => setSpray({ ...spray, area: raw })}
          />
        </div>

        <div className="calc-results">
          <div>
            <span>Água total</span>
            <strong>{sprayResult.litrosAguaTotal > 0 ? nf(sprayResult.litrosAguaTotal, 0) : "—"}</strong>
            <small>litros</small>
          </div>
          <div>
            <span>Produto total</span>
            <strong>{sprayResult.produtoTotal > 0 ? nf(sprayResult.produtoTotal, 2) : "—"}</strong>
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
          <NumField label="Área (ha)" step="0.1" value={areaHa} onChange={setAreaHa} />
        </div>

        <div className="calc-results">
          <div>
            <span>Metros quadrados</span>
            <strong>{convResult.metrosQuadrados > 0 ? nf(convResult.metrosQuadrados, 0) : "—"}</strong>
            <small>m²</small>
          </div>
          <div>
            <span>Alqueire paulista</span>
            <strong>{convResult.alqueirePaulista > 0 ? nf(convResult.alqueirePaulista, 3) : "—"}</strong>
            <small>2,42 ha cada</small>
          </div>
          <div>
            <span>Alqueire mineiro</span>
            <strong>{convResult.alqueireMineiro > 0 ? nf(convResult.alqueireMineiro, 3) : "—"}</strong>
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
