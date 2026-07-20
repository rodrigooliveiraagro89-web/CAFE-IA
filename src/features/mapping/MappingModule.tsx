import {
  Building2,
  Check,
  Crosshair,
  Crown,
  FileUp,
  LandPlot,
  MapPinned,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Undo2,
  X,
} from "lucide-react";
import { useMemo, useRef, useState, type FormEvent } from "react";
import type { AppView } from "../../app/navigation";
import {
  cropOptions,
  parsePlotBoundary,
  propertyLocation,
  type FarmPlot,
} from "../../domain/agriculturalContext";
import { canAddPlot, resolvePlan, TRIAL_DAYS } from "../../domain/plans";
import type { AgriculturalController } from "../../lib/useAgriculturalContext";
import {
  closePolygon,
  polygonAreaHectares,
  polygonValidationIssue,
} from "../ndvi/domain";
import type { Position } from "../ndvi/types";
import { MappingMap, type Basemap } from "./MappingMap";
import "./mapping.css";

type MappingModuleProps = {
  agriculture: AgriculturalController;
  planId?: string | null;
  trialAvailable?: boolean;
  onStartTrial?: () => void;
  onNavigate: (view: AppView) => void;
};

type SearchResult = {
  display_name: string;
  lat: string;
  lon: string;
};

type FocusTarget =
  | { center: Position; zoom?: number }
  | { bounds: Position[] }
  | null;

export function MappingModule({
  agriculture,
  planId = null,
  trialAvailable = false,
  onStartTrial,
  onNavigate,
}: MappingModuleProps) {
  const { state, selectedProperty } = agriculture;
  const [basemap, setBasemap] = useState<Basemap>("satelite");
  const [drawing, setDrawing] = useState(false);
  const [points, setPoints] = useState<Position[]>([]);
  const [focusTarget, setFocusTarget] = useState<FocusTarget>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchMessage, setSearchMessage] = useState("");
  const [saveMode, setSaveMode] = useState<"idle" | "existing" | "new">("idle");
  const [targetPlotId, setTargetPlotId] = useState("");
  const [newPlotName, setNewPlotName] = useState("");
  const [newPlotCrop, setNewPlotCrop] = useState<string>("Café");
  const [newPlotSeason, setNewPlotSeason] = useState("");
  const [feedback, setFeedback] = useState("");
  const boundaryFileRef = useRef<HTMLInputElement>(null);

  const propertyPlots = useMemo(
    () =>
      selectedProperty
        ? state.plots.filter((plot) => plot.propertyId === selectedProperty.id)
        : [],
    [state.plots, selectedProperty],
  );

  const plan = resolvePlan(planId);
  const plotAllowed = canAddPlot(plan, propertyPlots.length);

  const liveArea = useMemo(() => {
    if (points.length < 3) return null;
    try {
      return polygonAreaHectares(closePolygon(points));
    } catch {
      return null;
    }
  }, [points]);

  const geometryIssue = useMemo(
    () => (points.length > 0 ? polygonValidationIssue(points) : null),
    [points],
  );

  function focusPlot(plot: FarmPlot) {
    agriculture.selectPlot(plot.id);
    if (plot.geometry) {
      setFocusTarget({ bounds: plot.geometry.coordinates[0] });
    }
  }

  async function submitSearch(event: FormEvent) {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    setSearchMessage("Buscando local…");
    setSearchResults([]);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=br`,
        { headers: { Accept: "application/json" } },
      );
      if (!response.ok) throw new Error();
      const results = (await response.json()) as SearchResult[];
      setSearchResults(results);
      setSearchMessage(results.length === 0 ? "Nenhum local encontrado." : "");
    } catch {
      setSearchMessage("Não foi possível buscar agora. Tente novamente.");
    }
  }

  function goToResult(result: SearchResult) {
    setFocusTarget({
      center: [Number(result.lon), Number(result.lat)],
      zoom: 14,
    });
    setSearchResults([]);
    setSearchQuery(result.display_name.split(",")[0]);
  }

  function locateMe() {
    if (!navigator.geolocation) {
      setSearchMessage("Geolocalização indisponível neste navegador.");
      return;
    }
    setSearchMessage("Obtendo sua localização…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFocusTarget({
          center: [position.coords.longitude, position.coords.latitude],
          zoom: 16,
        });
        setSearchMessage("");
      },
      () => setSearchMessage("Não foi possível obter a localização."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function startDrawing() {
    setDrawing(true);
    setSaveMode("idle");
    setFeedback("");
  }

  function resetDrawing() {
    setPoints([]);
    setSaveMode("idle");
  }

  function cancelDrawing() {
    setDrawing(false);
    setPoints([]);
    setSaveMode("idle");
  }

  async function importBoundary(file: File | undefined) {
    if (!file) return;
    try {
      const result = parsePlotBoundary(file.name, await file.text());
      const ring = result.geometry.coordinates[0];
      const openRing =
        ring.length > 1 &&
        ring[0][0] === ring[ring.length - 1][0] &&
        ring[0][1] === ring[ring.length - 1][1]
          ? ring.slice(0, -1)
          : ring;
      setPoints(openRing);
      setDrawing(true);
      setFocusTarget({ bounds: ring });
      setFeedback(
        `Limite importado: ${result.areaHectares.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ha.`,
      );
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Não foi possível ler o arquivo.",
      );
    } finally {
      if (boundaryFileRef.current) boundaryFileRef.current.value = "";
    }
  }

  function saveToExistingPlot() {
    if (!targetPlotId || geometryIssue || points.length < 3) return;
    const geometry = closePolygon(points);
    const areaHectares = Number(polygonAreaHectares(geometry).toFixed(2));
    agriculture.updatePlotBoundary(targetPlotId, geometry, areaHectares);
    const plot = propertyPlots.find((candidate) => candidate.id === targetPlotId);
    setFeedback(
      `Limite salvo em ${plot?.name ?? "talhão"}: ${areaHectares.toLocaleString("pt-BR")} ha.`,
    );
    cancelDrawing();
  }

  function saveAsNewPlot(event: FormEvent) {
    event.preventDefault();
    if (!selectedProperty || geometryIssue || points.length < 3 || !plotAllowed) return;
    const geometry = closePolygon(points);
    const areaHectares = Number(polygonAreaHectares(geometry).toFixed(2));
    agriculture.addPlot(selectedProperty.id, {
      name: newPlotName,
      crop: newPlotCrop,
      variety: "",
      season: newPlotSeason,
      plantingDate: "",
      phenologicalStage: "",
      rowSpacing: "",
      plantSpacing: "",
      population: "",
      areaHectares,
      geometry,
    });
    setFeedback(
      `Talhão ${newPlotName} criado com ${areaHectares.toLocaleString("pt-BR")} ha.`,
    );
    setNewPlotName("");
    setNewPlotSeason("");
    cancelDrawing();
  }

  if (state.properties.length === 0) {
    return (
      <div className="page-stack platform-page">
        <header className="page-header context-page-header">
          <div>
            <span className="eyebrow">Medição por satélite</span>
            <h1>Mapeamento</h1>
            <p>Desenhe e meça talhões sobre imagem de satélite, vinculados à sua operação.</p>
          </div>
        </header>
        <section className="empty-state context-empty">
          <MapPinned size={31} />
          <h2>Cadastre uma propriedade</h2>
          <p>O mapeamento organiza as medições por propriedade e talhão.</p>
          <button type="button" onClick={() => onNavigate("propriedades")}>
            Cadastrar propriedade
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack platform-page mapping-page">
      <header className="page-header context-page-header">
        <div>
          <span className="eyebrow">Medição por satélite</span>
          <h1>Mapeamento</h1>
          <p>
            Desenhe o limite dos talhões sobre a imagem de satélite. A área é calculada na hora e
            fica vinculada ao talhão — disponível no NDVI, custos e relatório.
          </p>
        </div>
        <div className="mapping-basemap-toggle" role="group" aria-label="Estilo do mapa">
          <button
            type="button"
            data-active={basemap === "satelite"}
            onClick={() => setBasemap("satelite")}
          >
            Satélite
          </button>
          <button
            type="button"
            data-active={basemap === "mapa"}
            onClick={() => setBasemap("mapa")}
          >
            Mapa
          </button>
        </div>
      </header>

      <div className="mapping-workspace">
        <aside className="mapping-sidebar" aria-label="Propriedades e medições">
          {state.properties.map((property) => {
            const plots = state.plots.filter((plot) => plot.propertyId === property.id);
            const totalArea = plots.reduce((sum, plot) => sum + plot.areaHectares, 0);
            const active = property.id === selectedProperty?.id;
            return (
              <section className="mapping-group" data-active={active} key={property.id}>
                <button
                  type="button"
                  className="mapping-group-header"
                  onClick={() => agriculture.selectProperty(property.id)}
                >
                  <Building2 size={17} />
                  <span>
                    <strong>{property.name}</strong>
                    <small>
                      {propertyLocation(property)} · {plots.length}{" "}
                      {plots.length === 1 ? "talhão" : "talhões"} ·{" "}
                      {totalArea.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ha
                    </small>
                  </span>
                  {active && <Check size={16} aria-label="Selecionada" />}
                </button>
                {active && (
                  <ul className="mapping-measure-list">
                    {plots.map((plot) => (
                      <li key={plot.id}>
                        <button
                          type="button"
                          data-selected={plot.id === state.selectedPlotId}
                          onClick={() => focusPlot(plot)}
                        >
                          <LandPlot size={15} />
                          <span>
                            <strong>{plot.name}</strong>
                            <small>
                              {plot.crop} · {plot.areaHectares.toLocaleString("pt-BR")} ha
                            </small>
                          </span>
                          {!plot.geometry && (
                            <em className="mapping-no-boundary">sem limite</em>
                          )}
                        </button>
                      </li>
                    ))}
                    {plots.length === 0 && (
                      <li className="mapping-empty-measures">
                        Nenhum talhão ainda — desenhe a primeira medição.
                      </li>
                    )}
                  </ul>
                )}
              </section>
            );
          })}

          <div className="mapping-sidebar-actions">
            {!drawing ? (
              <>
                <button className="primary-button" type="button" onClick={startDrawing}>
                  <Plus size={17} /> Nova medição
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => boundaryFileRef.current?.click()}
                >
                  <FileUp size={16} /> Importar KML/GeoJSON
                </button>
                <input
                  ref={boundaryFileRef}
                  type="file"
                  hidden
                  accept=".geojson,.json,.kml,application/geo+json,application/vnd.google-earth.kml+xml"
                  onChange={(event) => void importBoundary(event.target.files?.[0])}
                />
              </>
            ) : (
              <>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={points.length === 0}
                  onClick={() => setPoints((current) => current.slice(0, -1))}
                >
                  <Undo2 size={16} /> Desfazer ponto
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={points.length === 0}
                  onClick={resetDrawing}
                >
                  <RotateCcw size={16} /> Limpar
                </button>
                <button className="secondary-button" type="button" onClick={cancelDrawing}>
                  <X size={16} /> Cancelar
                </button>
              </>
            )}
          </div>

          {feedback && (
            <p className="mapping-feedback" role="status">
              {feedback}
            </p>
          )}

          {drawing && points.length >= 3 && !geometryIssue && saveMode === "idle" && (
            <div className="mapping-save-panel">
              <strong>
                Medição pronta:{" "}
                {liveArea?.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ha
              </strong>
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  setSaveMode("existing");
                  setTargetPlotId(state.selectedPlotId || propertyPlots[0]?.id || "");
                }}
                disabled={propertyPlots.length === 0}
              >
                <Pencil size={16} /> Aplicar a um talhão
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => setSaveMode("new")}
              >
                <Plus size={16} /> Criar novo talhão
              </button>
            </div>
          )}

          {drawing && geometryIssue && points.length >= 3 && (
            <p className="mapping-feedback mapping-feedback-error" role="alert">
              {geometryIssue}
            </p>
          )}

          {saveMode === "existing" && (
            <div className="mapping-save-panel">
              <label>
                Talhão de destino
                <select
                  value={targetPlotId}
                  onChange={(event) => setTargetPlotId(event.target.value)}
                >
                  {propertyPlots.map((plot) => (
                    <option key={plot.id} value={plot.id}>
                      {plot.name}
                    </option>
                  ))}
                </select>
              </label>
              <button className="primary-button" type="button" onClick={saveToExistingPlot}>
                Salvar limite
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => setSaveMode("idle")}
              >
                Voltar
              </button>
            </div>
          )}

          {saveMode === "new" &&
            (plotAllowed ? (
              <form className="mapping-save-panel" onSubmit={saveAsNewPlot}>
                <label>
                  Nome do talhão
                  <input
                    required
                    value={newPlotName}
                    onChange={(event) => setNewPlotName(event.target.value)}
                  />
                </label>
                <label>
                  Cultura
                  <select
                    value={newPlotCrop}
                    onChange={(event) => setNewPlotCrop(event.target.value)}
                  >
                    {cropOptions.map((crop) => (
                      <option key={crop}>{crop}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Safra
                  <input
                    required
                    placeholder="Ex.: 2026/27"
                    value={newPlotSeason}
                    onChange={(event) => setNewPlotSeason(event.target.value)}
                  />
                </label>
                <button className="primary-button" type="submit">
                  Criar talhão medido
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setSaveMode("idle")}
                >
                  Voltar
                </button>
              </form>
            ) : (
              <div className="upgrade-notice" role="status">
                <Crown size={20} aria-hidden="true" />
                <div>
                  <strong>Limite do plano Grátis atingido</strong>
                  <p>
                    O plano {plan.label} permite {plan.maxPlotsPerProperty} talhões por
                    propriedade. Assine o Pro para talhões ilimitados.
                  </p>
                </div>
                {trialAvailable && onStartTrial && (
                  <button className="primary-button" type="button" onClick={onStartTrial}>
                    Testar o Pro grátis por {TRIAL_DAYS} dias
                  </button>
                )}
                <a
                  className="primary-button"
                  href="https://www.asaas.com/c/fw5jokq1e8cfdink"
                  target="_blank"
                  rel="noreferrer"
                >
                  Assinar o Pro — R$ 49,90/mês
                </a>
              </div>
            ))}
        </aside>

        <div className="mapping-map-panel">
          <form className="mapping-search" onSubmit={(event) => void submitSearch(event)}>
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              placeholder="Buscar cidade ou local (ex.: Machado MG)"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              aria-label="Buscar local no mapa"
            />
            <button className="secondary-button" type="submit">
              Buscar
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={locateMe}
              title="Usar minha localização"
            >
              <Crosshair size={16} />
            </button>
          </form>
          {(searchResults.length > 0 || searchMessage) && (
            <div className="mapping-search-results">
              {searchMessage && <p>{searchMessage}</p>}
              {searchResults.map((result) => (
                <button
                  key={`${result.lat}-${result.lon}`}
                  type="button"
                  onClick={() => goToResult(result)}
                >
                  <MapPinned size={14} /> {result.display_name}
                </button>
              ))}
            </div>
          )}

          <MappingMap
            basemap={basemap}
            plots={propertyPlots}
            selectedPlotId={state.selectedPlotId}
            drawing={drawing}
            points={points}
            focusTarget={focusTarget}
            onAddPoint={(position) => setPoints((current) => [...current, position])}
            onMovePoint={(index, position) =>
              setPoints((current) =>
                current.map((point, i) => (i === index ? position : point)),
              )
            }
            onSelectPlot={(plotId) => agriculture.selectPlot(plotId)}
          />

          {drawing && (
            <div className="mapping-area-badge" aria-live="polite">
              {points.length < 3 ? (
                <span>
                  {points.length === 0
                    ? "Toque no mapa para começar a medir"
                    : `${points.length} ${points.length === 1 ? "ponto" : "pontos"} — adicione ${3 - points.length} ou mais`}
                </span>
              ) : (
                <span>
                  Área medida:{" "}
                  <strong>
                    {liveArea !== null
                      ? `${liveArea.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ha`
                      : "—"}
                  </strong>
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
