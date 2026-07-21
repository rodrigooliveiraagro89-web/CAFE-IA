import {
  Building2,
  Check,
  Crosshair,
  Crown,
  FileUp,
  Footprints,
  LandPlot,
  LocateFixed,
  MapPin,
  MapPinned,
  Pencil,
  Plus,
  RotateCcw,
  Satellite,
  Search,
  Undo2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
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
import { MappingMap, type Basemap, type LiveLocation } from "./MappingMap";
import "./mapping.css";

const MAX_ACCEPTABLE_ACCURACY_METERS = 10;
const DUPLICATE_POINT_THRESHOLD_METERS = 2;
const AUTO_CLOSE_THRESHOLD_METERS = 10;

function haversineMeters(a: Position, b: Position): number {
  const earthRadius = 6371008.8;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(b[1] - a[1]);
  const dLon = toRadians(b[0] - a[0]);
  const lat1 = toRadians(a[1]);
  const lat2 = toRadians(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

function pathPerimeterMeters(points: Position[], closed: boolean): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += haversineMeters(points[i - 1], points[i]);
  }
  if (closed && points.length >= 3) {
    total += haversineMeters(points[points.length - 1], points[0]);
  }
  return total;
}

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
  const [walking, setWalking] = useState(false);
  const [liveLocation, setLiveLocation] = useState<LiveLocation | null>(null);
  const [follow, setFollow] = useState(true);
  const [gpsMessage, setGpsMessage] = useState("");
  const watchIdRef = useRef<number | null>(null);
  const boundaryFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation?.clearWatch(watchIdRef.current);
      }
    };
  }, []);

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
    stopWalking();
  }

  function startWalking() {
    if (!navigator.geolocation) {
      setGpsMessage("Geolocalização indisponível neste navegador.");
      return;
    }
    setWalking(true);
    setDrawing(false);
    setSaveMode("idle");
    setFeedback("");
    setFollow(true);
    setGpsMessage("Obtendo sinal de GPS…");
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setLiveLocation({
          position: [position.coords.longitude, position.coords.latitude],
          accuracy: position.coords.accuracy,
        });
        setGpsMessage("");
      },
      () => {
        setGpsMessage("Não foi possível obter o GPS. Verifique a permissão de localização.");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
  }

  function stopWalking() {
    if (watchIdRef.current !== null) {
      navigator.geolocation?.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setWalking(false);
    setLiveLocation(null);
    setGpsMessage("");
  }

  function capturePoint() {
    if (!liveLocation) {
      setGpsMessage("Aguardando sinal de GPS…");
      return;
    }
    const { position, accuracy } = liveLocation;
    if (accuracy > MAX_ACCEPTABLE_ACCURACY_METERS) {
      setGpsMessage(
        `Precisão do GPS fraca (±${accuracy.toFixed(0)} m). Aguarde melhorar ou capture mesmo assim tocando de novo.`,
      );
      // Segundo toque com a mesma mensagem ativa captura mesmo com precisão fraca.
      if (!gpsMessage.startsWith("Precisão do GPS fraca")) return;
    }
    const last = points[points.length - 1];
    if (last && haversineMeters(last, position) < DUPLICATE_POINT_THRESHOLD_METERS) {
      setGpsMessage("Ponto muito próximo do anterior — ande mais um pouco antes de capturar.");
      return;
    }
    if (
      points.length >= 3 &&
      haversineMeters(points[0], position) < AUTO_CLOSE_THRESHOLD_METERS
    ) {
      setGpsMessage("");
      setFeedback("Você voltou ao ponto inicial — o perímetro foi fechado.");
      stopWalking();
      setDrawing(true);
      return;
    }
    setGpsMessage("");
    setPoints((current) => [...current, position]);
  }

  function finishWalking() {
    stopWalking();
    if (points.length >= 3) {
      setDrawing(true);
      setFeedback("Caminhada concluída — revise os pontos ou salve a medição.");
    } else {
      setFeedback("Caminhada encerrada sem pontos suficientes (mínimo 3).");
      setPoints([]);
    }
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
            {!drawing && !walking ? (
              <>
                <button className="primary-button" type="button" onClick={startWalking}>
                  <Footprints size={17} /> Mapear caminhando (GPS)
                </button>
                <button className="secondary-button" type="button" onClick={startDrawing}>
                  <Plus size={17} /> Desenhar no mapa
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
            ) : walking ? (
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
                  className="primary-button"
                  type="button"
                  disabled={points.length < 3}
                  onClick={finishWalking}
                >
                  <Check size={16} /> Concluir caminhada
                </button>
                <button className="secondary-button" type="button" onClick={cancelDrawing}>
                  <X size={16} /> Cancelar
                </button>
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

          {(drawing || walking) && points.length > 0 && (
            <div className="mapping-stats" aria-live="polite">
              <span>
                <small>Perímetro</small>
                <strong>
                  {pathPerimeterMeters(points, points.length >= 3).toLocaleString("pt-BR", {
                    maximumFractionDigits: 0,
                  })}{" "}
                  m
                </strong>
              </span>
              <span>
                <small>Área</small>
                <strong>
                  {liveArea !== null
                    ? `${liveArea.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ha`
                    : "—"}
                </strong>
              </span>
              <span>
                <small>Pontos</small>
                <strong>{points.length}</strong>
              </span>
            </div>
          )}

          {walking && (
            <div className="mapping-gps-panel">
              <span className="mapping-gps-status" data-weak={Boolean(liveLocation && liveLocation.accuracy > MAX_ACCEPTABLE_ACCURACY_METERS)}>
                <Satellite size={15} />
                {liveLocation
                  ? `GPS ±${liveLocation.accuracy.toFixed(0)} m`
                  : "Aguardando GPS…"}
              </span>
              <button
                className="secondary-button"
                type="button"
                data-active={follow}
                onClick={() => setFollow((current) => !current)}
              >
                <LocateFixed size={15} /> {follow ? "Seguindo você" : "Seguir minha posição"}
              </button>
              {gpsMessage && <p className="mapping-gps-message">{gpsMessage}</p>}
            </div>
          )}

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
            liveLocation={liveLocation}
            follow={walking && follow}
            onAddPoint={(position) => setPoints((current) => [...current, position])}
            onMovePoint={(index, position) =>
              setPoints((current) =>
                current.map((point, i) => (i === index ? position : point)),
              )
            }
            onSelectPlot={(plotId) => agriculture.selectPlot(plotId)}
          />

          {walking && (
            <button
              className="mapping-capture-button"
              type="button"
              onClick={capturePoint}
              disabled={!liveLocation}
            >
              <MapPin size={20} /> Capturar ponto
            </button>
          )}

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
