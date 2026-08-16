import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Building2, Check, Sprout } from "lucide-react";
import {
  cropOptions,
  recentSeasons,
  type PlotInput,
  type PropertyInput,
} from "../../domain/agriculturalContext";
import { parseNumberBR } from "../../domain/parseNumber";
import type { AgriculturalController } from "../../lib/useAgriculturalContext";

type AreaOnboardingProps = {
  agriculture: AgriculturalController;
  /** Nome do usuário, para pré-preencher o produtor. */
  producerName?: string;
  onDone: () => void;
  onCancel: () => void;
};

/**
 * Primeira etapa do novo usuário: cadastrar a área de forma guiada e simples —
 * só o essencial, um passo de cada vez (propriedade → primeiro talhão). O resto
 * (responsável, espaçamento, limite no mapa) fica para depois, sem travar o
 * começo. Ao concluir, o app já mostra o painel com o talhão criado.
 */
export function AreaOnboarding({ agriculture, producerName, onDone, onCancel }: AreaOnboardingProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [prop, setProp] = useState({ name: "", city: "", state: "", producer: producerName ?? "" });
  const [plot, setPlot] = useState<{ name: string; crop: string; areaHectares: string; season: string }>(
    { name: "", crop: cropOptions[0], areaHectares: "", season: "" },
  );
  const [areaInvalida, setAreaInvalida] = useState(false);

  const seasons = recentSeasons(2026);

  function irParaTalhao(event: FormEvent) {
    event.preventDefault();
    setStep(2);
  }

  function concluir(event: FormEvent) {
    event.preventDefault();
    const area = parseNumberBR(plot.areaHectares);
    if (area === null || area <= 0) {
      setAreaInvalida(true);
      return;
    }
    const propertyInput: PropertyInput = {
      name: prop.name.trim(),
      producer: prop.producer.trim(),
      responsible: "",
      city: prop.city.trim(),
      state: prop.state.trim().toLocaleUpperCase("pt-BR"),
    };
    const propertyId = agriculture.addProperty(propertyInput);
    const plotInput: PlotInput = {
      name: plot.name.trim(),
      crop: plot.crop,
      variety: "",
      season: plot.season || seasons[1],
      plantingDate: "",
      phenologicalStage: "",
      rowSpacing: "",
      plantSpacing: "",
      population: "",
      areaHectares: area,
      geometry: null,
    };
    agriculture.addPlot(propertyId, plotInput);
    onDone();
  }

  return (
    <div className="onboarding">
      <div className="onboarding-steps" aria-hidden="true">
        <span className={step === 1 ? "on" : "done"}>
          {step > 1 ? <Check size={14} /> : "1"} Propriedade
        </span>
        <span className="onboarding-steps-line" />
        <span className={step === 2 ? "on" : ""}>2 Primeiro talhão</span>
      </div>

      {step === 1 ? (
        <form className="onboarding-card" onSubmit={irParaTalhao}>
          <div className="onboarding-head">
            <span className="onboarding-icon"><Building2 size={22} /></span>
            <div>
              <h1>Cadastre sua propriedade</h1>
              <p>Só o essencial para começar — dá para completar o resto depois.</p>
            </div>
          </div>
          <label className="onboarding-field">
            Nome da propriedade
            <input
              required
              autoFocus
              value={prop.name}
              onChange={(e) => setProp((c) => ({ ...c, name: e.target.value }))}
              placeholder="Ex.: Sítio Boa Vista"
            />
          </label>
          <div className="onboarding-row">
            <label className="onboarding-field" style={{ flex: 3 }}>
              Município
              <input
                required
                value={prop.city}
                onChange={(e) => setProp((c) => ({ ...c, city: e.target.value }))}
                placeholder="Ex.: Ouro Fino"
              />
            </label>
            <label className="onboarding-field" style={{ flex: 1 }}>
              UF
              <input
                required
                maxLength={2}
                value={prop.state}
                onChange={(e) => setProp((c) => ({ ...c, state: e.target.value.toLocaleUpperCase("pt-BR") }))}
                placeholder="MG"
              />
            </label>
          </div>
          <label className="onboarding-field">
            Produtor <span className="onboarding-opt">(opcional)</span>
            <input
              value={prop.producer}
              onChange={(e) => setProp((c) => ({ ...c, producer: e.target.value }))}
              placeholder="Quem toca a lavoura"
            />
          </label>
          <div className="onboarding-actions">
            <button type="button" className="text-button" onClick={onCancel}>
              <ArrowLeft size={16} /> Voltar
            </button>
            <button type="submit" className="primary-button">
              Continuar <ArrowRight size={17} />
            </button>
          </div>
        </form>
      ) : (
        <form className="onboarding-card" onSubmit={concluir}>
          <div className="onboarding-head">
            <span className="onboarding-icon"><Sprout size={22} /></span>
            <div>
              <h1>Adicione o primeiro talhão</h1>
              <p>A área produtiva onde entram laudo, adubação e NDVI. Pode cadastrar mais depois.</p>
            </div>
          </div>
          <label className="onboarding-field">
            Nome do talhão
            <input
              required
              autoFocus
              value={plot.name}
              onChange={(e) => setPlot((c) => ({ ...c, name: e.target.value }))}
              placeholder="Ex.: Talhão da Casa"
            />
          </label>
          <div className="onboarding-row">
            <label className="onboarding-field" style={{ flex: 2 }}>
              Cultura
              <select value={plot.crop} onChange={(e) => setPlot((c) => ({ ...c, crop: e.target.value }))}>
                {cropOptions.map((crop) => (
                  <option key={crop} value={crop}>{crop}</option>
                ))}
              </select>
            </label>
            <label className="onboarding-field" style={{ flex: 1 }}>
              Área (ha)
              <input
                required
                inputMode="decimal"
                value={plot.areaHectares}
                aria-invalid={areaInvalida}
                onChange={(e) => {
                  setPlot((c) => ({ ...c, areaHectares: e.target.value }));
                  setAreaInvalida(false);
                }}
                placeholder="Ex.: 3,5"
              />
            </label>
          </div>
          {areaInvalida && <small className="onboarding-err">Informe a área em hectares (ex.: 3,5).</small>}
          <label className="onboarding-field">
            Safra <span className="onboarding-opt">(opcional)</span>
            <input
              list="onboarding-safras"
              value={plot.season}
              onChange={(e) => setPlot((c) => ({ ...c, season: e.target.value }))}
              placeholder={seasons[1]}
            />
            <datalist id="onboarding-safras">
              {seasons.map((s) => <option key={s} value={s} />)}
            </datalist>
          </label>
          <div className="onboarding-actions">
            <button type="button" className="text-button" onClick={() => setStep(1)}>
              <ArrowLeft size={16} /> Voltar
            </button>
            <button type="submit" className="primary-button">
              <Check size={17} /> Concluir e abrir o painel
            </button>
          </div>
        </form>
      )}

      <p className="onboarding-foot">
        Prefere só ver funcionando? Volte e use os <strong>dados de exemplo</strong>.
      </p>
    </div>
  );
}
