import {
  Building2,
  Check,
  Crown,
  FileUp,
  LandPlot,
  MapPinned,
  Plus,
  Trash2,
  Wheat,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import {
  cropOptions,
  parsePlotBoundary,
  propertyLocation,
  type PlotInput,
  type PropertyInput,
} from "../../domain/agriculturalContext";
import { canAddPlot, canAddProperty, resolvePlan } from "../../domain/plans";
import type { AgriculturalController } from "../../lib/useAgriculturalContext";

type PropertyManagerProps = {
  agriculture: AgriculturalController;
  planId?: string | null;
};

function UpgradeNotice({ message }: { message: string }) {
  return (
    <div className="upgrade-notice" role="status">
      <Crown size={20} aria-hidden="true" />
      <div>
        <strong>Limite do plano Grátis atingido</strong>
        <p>{message}</p>
      </div>
      <a
        className="primary-button"
        href="./landing.html#planos"
        target="_blank"
        rel="noreferrer"
      >
        Conhecer o plano Pro
      </a>
    </div>
  );
}

const blankProperty: PropertyInput = {
  name: "",
  producer: "",
  responsible: "",
  city: "",
  state: "",
};

const blankPlot: PlotInput = {
  name: "",
  crop: "Café",
  variety: "",
  season: "",
  plantingDate: "",
  phenologicalStage: "",
  rowSpacing: "",
  plantSpacing: "",
  population: "",
  areaHectares: 0,
  geometry: null,
};

export function PropertyManager({ agriculture, planId = null }: PropertyManagerProps) {
  const { state, selectedProperty, selectedPlot } = agriculture;
  const [propertyDraft, setPropertyDraft] = useState(blankProperty);
  const [plotDraft, setPlotDraft] = useState(blankPlot);
  const [propertyFormOpen, setPropertyFormOpen] = useState(state.properties.length === 0);
  const [plotFormOpen, setPlotFormOpen] = useState(false);
  const [boundaryMessage, setBoundaryMessage] = useState("");

  const propertyPlots = selectedProperty
    ? state.plots.filter((plot) => plot.propertyId === selectedProperty.id)
    : [];

  const plan = resolvePlan(planId);
  const propertyAllowed = canAddProperty(plan, state.properties.length);
  const plotAllowed = canAddPlot(plan, propertyPlots.length);

  function submitProperty(event: FormEvent) {
    event.preventDefault();
    if (!propertyAllowed) return;
    agriculture.addProperty(propertyDraft);
    setPropertyDraft(blankProperty);
    setPropertyFormOpen(false);
    setPlotFormOpen(true);
  }

  function submitPlot(event: FormEvent) {
    event.preventDefault();
    if (!selectedProperty || !plotAllowed) return;
    agriculture.addPlot(selectedProperty.id, plotDraft);
    setPlotDraft(blankPlot);
    setBoundaryMessage("");
    setPlotFormOpen(false);
  }

  async function importBoundary(file: File | undefined) {
    if (!file) return;
    try {
      const result = parsePlotBoundary(file.name, await file.text());
      setPlotDraft((current) => ({
        ...current,
        geometry: result.geometry,
        areaHectares: Number(result.areaHectares.toFixed(2)),
      }));
      setBoundaryMessage(
        `Limite importado: ${result.areaHectares.toLocaleString("pt-BR", {
          maximumFractionDigits: 2,
        })} ha calculados.`,
      );
    } catch (error) {
      setBoundaryMessage(error instanceof Error ? error.message : "Não foi possível ler o limite.");
    }
  }

  return (
    <div className="page-stack platform-page">
      <header className="page-header context-page-header">
        <div>
          <span className="eyebrow">Estrutura da operação</span>
          <h1>Propriedades e talhões</h1>
          <p>
            Organize a produção por propriedade, área, cultura e safra. O contexto selecionado
            acompanha análises, mapas, atividades e custos.
          </p>
        </div>
        {propertyAllowed && (
          <button className="primary-button" type="button" onClick={() => setPropertyFormOpen(true)}>
            <Plus size={18} /> Nova propriedade
          </button>
        )}
      </header>

      {!propertyAllowed && (
        <UpgradeNotice message={`O plano ${plan.label} permite ${plan.maxProperties} propriedade. Para gerenciar mais propriedades — ideal para consultores com carteira de clientes — assine o Pro.`} />
      )}

      {propertyFormOpen && propertyAllowed && (
        <form className="data-form panel-card" onSubmit={submitProperty}>
          <div className="panel-title">
            <Building2 size={21} />
            <div><span className="eyebrow">Cadastro</span><h2>Identificação da propriedade</h2></div>
          </div>
          <div className="form-grid">
            <label>
              Nome da propriedade
              <input
                required
                value={propertyDraft.name}
                onChange={(event) =>
                  setPropertyDraft((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Ex.: Fazenda Boa Esperança"
              />
            </label>
            <label>
              Produtor ou empresa
              <input
                required
                value={propertyDraft.producer}
                onChange={(event) =>
                  setPropertyDraft((current) => ({ ...current, producer: event.target.value }))
                }
              />
            </label>
            <label>
              Responsável técnico
              <input
                value={propertyDraft.responsible}
                onChange={(event) =>
                  setPropertyDraft((current) => ({ ...current, responsible: event.target.value }))
                }
              />
            </label>
            <label>
              Município
              <input
                required
                value={propertyDraft.city}
                onChange={(event) =>
                  setPropertyDraft((current) => ({ ...current, city: event.target.value }))
                }
              />
            </label>
            <label>
              UF
              <input
                required
                maxLength={2}
                value={propertyDraft.state}
                onChange={(event) =>
                  setPropertyDraft((current) => ({
                    ...current,
                    state: event.target.value.toLocaleUpperCase("pt-BR"),
                  }))
                }
                placeholder="MG"
              />
            </label>
          </div>
          <div className="form-actions">
            {state.properties.length > 0 && (
              <button className="secondary-button" type="button" onClick={() => setPropertyFormOpen(false)}>
                Cancelar
              </button>
            )}
            <button className="primary-button" type="submit">Salvar propriedade</button>
          </div>
        </form>
      )}

      {state.properties.length === 0 ? (
        <section className="empty-state context-empty">
          <MapPinned size={31} />
          <h2>Comece pela propriedade</h2>
          <p>Nenhum dado de exemplo foi inserido. Cadastre a operação real para ativar o painel.</p>
        </section>
      ) : (
        <>
          <section aria-labelledby="property-list-title">
            <div className="section-heading compact-heading">
              <div><span className="eyebrow">Contextos</span><h2 id="property-list-title">Propriedades</h2></div>
            </div>
            <div className="selection-grid">
              {state.properties.map((property) => {
                const active = property.id === selectedProperty?.id;
                const count = state.plots.filter((plot) => plot.propertyId === property.id).length;
                return (
                  <article className="selection-card" data-active={active} key={property.id}>
                    <button className="selection-main" type="button" onClick={() => agriculture.selectProperty(property.id)}>
                      <span className="selection-icon"><Building2 size={21} /></span>
                      <span>
                        <strong>{property.name}</strong>
                        <small>{property.producer} · {propertyLocation(property)}</small>
                        <small>{count} {count === 1 ? "talhão" : "talhões"}</small>
                      </span>
                      {active && <Check size={20} aria-label="Selecionada" />}
                    </button>
                    <button
                      className="danger-icon"
                      type="button"
                      title="Excluir propriedade"
                      onClick={() => {
                        if (window.confirm(`Excluir ${property.name} e seus talhões?`)) {
                          agriculture.removeProperty(property.id);
                        }
                      }}
                    >
                      <Trash2 size={17} />
                    </button>
                  </article>
                );
              })}
            </div>
          </section>

          {selectedProperty && (
            <section className="panel-card">
              <div className="section-heading compact-heading">
                <div>
                  <span className="eyebrow">{selectedProperty.name}</span>
                  <h2>Talhões e culturas</h2>
                  <p>Selecione a área operacional ou cadastre um novo limite.</p>
                </div>
                {plotAllowed && (
                  <button className="secondary-button" type="button" onClick={() => setPlotFormOpen(true)}>
                    <Plus size={17} /> Novo talhão
                  </button>
                )}
              </div>

              {!plotAllowed && (
                <UpgradeNotice message={`O plano ${plan.label} permite ${plan.maxPlotsPerProperty} talhões por propriedade. Assine o Pro para talhões ilimitados.`} />
              )}

              {plotFormOpen && plotAllowed && (
                <form className="data-form inset-form" onSubmit={submitPlot}>
                  <div className="form-grid">
                    <label>
                      Nome do talhão
                      <input required value={plotDraft.name} onChange={(event) => setPlotDraft((current) => ({ ...current, name: event.target.value }))} />
                    </label>
                    <label>
                      Cultura
                      <select value={plotDraft.crop} onChange={(event) => setPlotDraft((current) => ({ ...current, crop: event.target.value }))}>
                        {cropOptions.map((crop) => <option key={crop}>{crop}</option>)}
                      </select>
                    </label>
                    <label>
                      Cultivar / variedade
                      <input value={plotDraft.variety} onChange={(event) => setPlotDraft((current) => ({ ...current, variety: event.target.value }))} />
                    </label>
                    <label>
                      Safra
                      <input required value={plotDraft.season} onChange={(event) => setPlotDraft((current) => ({ ...current, season: event.target.value }))} placeholder="Ex.: 2026/27" />
                    </label>
                    <label>
                      Data de plantio
                      <input type="date" value={plotDraft.plantingDate} onChange={(event) => setPlotDraft((current) => ({ ...current, plantingDate: event.target.value }))} />
                    </label>
                    <label>
                      Estágio fenológico
                      <input value={plotDraft.phenologicalStage} onChange={(event) => setPlotDraft((current) => ({ ...current, phenologicalStage: event.target.value }))} />
                    </label>
                    <label>
                      Área (ha)
                      <input required min="0.01" step="0.01" type="number" value={plotDraft.areaHectares || ""} onChange={(event) => setPlotDraft((current) => ({ ...current, areaHectares: Number(event.target.value) }))} />
                    </label>
                    <label>
                      Espaçamento entre linhas
                      <input value={plotDraft.rowSpacing} onChange={(event) => setPlotDraft((current) => ({ ...current, rowSpacing: event.target.value }))} placeholder="Ex.: 3,5 m" />
                    </label>
                    <label>
                      Espaçamento entre plantas
                      <input value={plotDraft.plantSpacing} onChange={(event) => setPlotDraft((current) => ({ ...current, plantSpacing: event.target.value }))} placeholder="Ex.: 0,7 m" />
                    </label>
                    <label>
                      População de plantas
                      <input value={plotDraft.population} onChange={(event) => setPlotDraft((current) => ({ ...current, population: event.target.value }))} placeholder="Plantas/ha" />
                    </label>
                  </div>
                  <label className="boundary-upload">
                    <FileUp size={20} />
                    <span><strong>Importar limite do talhão</strong><small>GeoJSON ou KML. A área será recalculada pelo polígono.</small></span>
                    <input
                      type="file"
                      accept=".geojson,.json,.kml,application/geo+json,application/vnd.google-earth.kml+xml"
                      onChange={(event) => void importBoundary(event.target.files?.[0])}
                    />
                  </label>
                  <p className="form-helper" aria-live="polite">
                    {boundaryMessage || "Arquivos Shapefile exigem conversão para GeoJSON nesta versão."}
                  </p>
                  <div className="form-actions">
                    <button className="secondary-button" type="button" onClick={() => setPlotFormOpen(false)}>Cancelar</button>
                    <button className="primary-button" type="submit">Salvar talhão</button>
                  </div>
                </form>
              )}

              {propertyPlots.length === 0 && !plotFormOpen ? (
                <div className="inline-empty">
                  <LandPlot size={24} />
                  <div><strong>Nenhum talhão cadastrado</strong><p>Adicione a primeira área produtiva desta propriedade.</p></div>
                </div>
              ) : (
                <div className="plot-grid">
                  {propertyPlots.map((plot) => (
                    <article className="plot-card" data-active={plot.id === selectedPlot?.id} key={plot.id}>
                      <button type="button" onClick={() => agriculture.selectPlot(plot.id)}>
                        <span className="plot-crop-icon"><Wheat size={21} /></span>
                        <span><small>{plot.crop}</small><strong>{plot.name}</strong></span>
                        <span className="plot-area">{plot.areaHectares.toLocaleString("pt-BR")} ha</span>
                        <span className="plot-meta">{plot.season}{plot.variety ? ` · ${plot.variety}` : ""}</span>
                        {plot.geometry && <span className="geometry-badge"><MapPinned size={13} /> Limite geográfico</span>}
                      </button>
                      <button
                        className="danger-icon"
                        type="button"
                        title="Excluir talhão"
                        onClick={() => {
                          if (window.confirm(`Excluir o talhão ${plot.name}?`)) agriculture.removePlot(plot.id);
                        }}
                      >
                        <Trash2 size={17} />
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
