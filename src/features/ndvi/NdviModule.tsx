import {
  AlertCircle,
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleOff,
  Cloud,
  Download,
  ExternalLink,
  Focus,
  Layers3,
  LoaderCircle,
  MapPinned,
  Maximize2,
  Navigation,
  Pause,
  Play,
  RotateCcw,
  Save,
  Satellite,
  Search,
  ShieldCheck,
  Sparkles,
  SquareStack,
  Trash2,
  TriangleAlert,
  Undo2,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AppView } from "../../app/navigation";
import { parsePlotBoundary } from "../../domain/agriculturalContext";
import type { FieldRecordInput } from "../../domain/fieldRecords";
import type { AgriculturalController } from "../../lib/useAgriculturalContext";
import {
  closePolygon,
  hasSufficientCoverage,
  polygonAreaHectares,
  polygonValidationIssue,
  responsibleInterpretation,
} from "./domain";
import {
  buildManagementZones,
  ZONES_SOIL_NOTE,
  zonesDiagnosis,
} from "./managementZones";
import { NdviMap } from "./NdviMap";
import {
  cancelNdviJob,
  getProcessingApiUrl,
  processNdvi,
} from "./processingClient";
import { latestStablePublicDate } from "./publicLayers";
import {
  getStacRootUrl,
  NdviCatalogError,
  searchSentinelScenes,
} from "./stacClient";
import type {
  NdviJobResponse,
  NdviJobState,
  NdviResult,
  NdviScene,
  Position,
} from "./types";

type NdviModuleProps = {
  onNavigate: (view: AppView) => void;
  agriculture: AgriculturalController;
  onCreateInspection: (input: FieldRecordInput) => void;
  accessToken: string;
  history: NdviResult[];
  onAddResult: (result: NdviResult) => void;
};

type SearchState =
  | { status: "idle" }
  | { status: "searching"; message: string }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

type LocationState =
  | { status: "idle"; message: string }
  | { status: "locating"; message: string }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

type SketchState =
  | { status: "idle"; message: string }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const minimumValidCoveragePercentage = 70;

export function NdviModule({
  onNavigate,
  agriculture,
  onCreateInspection,
  accessToken,
  history,
  onAddResult,
}: NdviModuleProps) {
  const today = useMemo(() => formatInputDate(new Date()), []);
  const ninetyDaysAgo = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 90);
    return formatInputDate(date);
  }, []);
  const [points, setPoints] = useState<Position[]>(() =>
    pointsFromGeometry(agriculture.selectedPlot?.geometry?.coordinates[0]),
  );
  const [drawing, setDrawing] = useState(false);
  const [dateStart, setDateStart] = useState(ninetyDaysAgo);
  const [dateEnd, setDateEnd] = useState(today);
  const [maximumCloudCover, setMaximumCloudCover] = useState(30);
  const [scenes, setScenes] = useState<NdviScene[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState("");
  const [searchState, setSearchState] = useState<SearchState>({ status: "idle" });
  const [jobState, setJobState] = useState<NdviJobState>({ status: "idle" });
  const [activeLayer, setActiveLayer] = useState<"true-color" | "ndvi">("ndvi");
  const [classificationMode, setClassificationMode] = useState<"relative" | "general">(
    "relative",
  );
  const [opacity, setOpacity] = useState(0.78);
  const [currentLocation, setCurrentLocation] = useState<Position | null>(null);
  const [locationState, setLocationState] = useState<LocationState>({
    status: "idle",
    message: "A localização só é acessada quando você autorizar.",
  });
  const [sketchState, setSketchState] = useState<SketchState>({
    status: "idle",
    message: "Desenhe pelo menos três pontos para criar o croqui.",
  });
  const [regionalLayerDate, setRegionalLayerDate] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [compareLeft, setCompareLeft] = useState("");
  const [compareRight, setCompareRight] = useState("");
  const [timelinePlaying, setTimelinePlaying] = useState(false);
  const processingAbortController = useRef<AbortController | null>(null);
  const searchAbortController = useRef<AbortController | null>(null);
  const mapPanelRef = useRef<HTMLDivElement | null>(null);
  const boundaryFileRef = useRef<HTMLInputElement | null>(null);

  const geometryIssue = useMemo(
    () => (points.length ? polygonValidationIssue(points) : null),
    [points],
  );
  const polygon = useMemo(() => {
    if (geometryIssue) return null;
    try {
      return closePolygon(points);
    } catch {
      return null;
    }
  }, [geometryIssue, points]);
  const areaHectares = useMemo(
    () => (polygon ? polygonAreaHectares(polygon) : 0),
    [polygon],
  );
  const selectedScene = scenes.find((scene) => scene.id === selectedSceneId) ?? null;
  const currentResult =
    jobState.status === "completed" ? jobState.result : history[0] ?? null;
  const processingApiAvailable = Boolean(getProcessingApiUrl());
  const publicLayerDate = useMemo(
    () => latestStablePublicDate(today, regionalLayerDate ?? dateEnd),
    [dateEnd, regionalLayerDate, today],
  );
  const compareLeftResult = history.find((result) => result.id === compareLeft) ?? null;
  const compareRightResult = history.find((result) => result.id === compareRight) ?? null;
  const displayedClasses =
    classificationMode === "relative"
      ? currentResult?.relativeClasses ?? currentResult?.classes ?? []
      : currentResult?.generalClasses ?? currentResult?.classes ?? [];
  const managementZones = useMemo(
    () => (currentResult ? buildManagementZones(currentResult) : []),
    [currentResult],
  );
  const zonesDiagnosisText = currentResult ? zonesDiagnosis(currentResult) : "";

  useEffect(() => {
    if (!timelinePlaying || history.length < 2) return;

    let index = 0;
    const interval = window.setInterval(() => {
      const result = history[index % history.length];
      setJobState({ status: "completed", jobId: result.id, result });
      index += 1;
    }, 1_500);

    return () => window.clearInterval(interval);
  }, [history, timelinePlaying]);

  async function handleSceneSearch() {
    if (!polygon) {
      setSearchState({
        status: "error",
        message: "Desenhe um talhão com pelo menos três pontos antes de buscar imagens.",
      });
      return;
    }

    searchAbortController.current?.abort();
    const controller = new AbortController();
    searchAbortController.current = controller;
    setSearchState({
      status: "searching",
      message: "Consultando o catálogo público Copernicus…",
    });
    setScenes([]);
    setSelectedSceneId("");

    try {
      const foundScenes = await searchSentinelScenes({
        polygon,
        dateStart,
        dateEnd,
        maximumCloudCover,
        signal: controller.signal,
      });
      setScenes(foundScenes);
      setSelectedSceneId(foundScenes[0]?.id ?? "");
      setSearchState({
        status: "success",
        message: `${foundScenes.length} ${foundScenes.length === 1 ? "imagem encontrada" : "imagens encontradas"}. A primeira tem a menor cobertura de nuvens da cena.`,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setSearchState({
        status: "error",
        message:
          error instanceof NdviCatalogError
            ? error.message
            : "Não foi possível concluir a busca de imagens.",
      });
    }
  }

  async function handleProcessing() {
    if (!polygon || !selectedScene) return;

    const controller = new AbortController();
    processingAbortController.current = controller;
    setJobState({ status: "submitting", message: "Preparando o recorte do talhão…" });

    try {
      const result = await processNdvi(
        {
          sceneId: selectedScene.id,
          collection: selectedScene.collection,
          polygon,
          plotId: agriculture.selectedPlot?.id ?? "area-avulsa",
          minimumValidCoveragePercentage,
        },
        accessToken,
        updateJobState,
        controller.signal,
      );
      onAddResult(result);
      setJobState({ status: "completed", jobId: result.id, result });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setJobState({ status: "cancelled", message: "Processamento cancelado." });
        return;
      }
      setJobState({
        status: "error",
        message: error instanceof Error ? error.message : "O processamento falhou.",
      });
    }
  }

  async function handleCancelProcessing() {
    const jobId =
      jobState.status === "queued" || jobState.status === "processing"
        ? jobState.jobId
        : null;
    processingAbortController.current?.abort();
    if (jobId) await cancelNdviJob(jobId);
    setJobState({ status: "cancelled", message: "Processamento cancelado." });
  }

  function updateJobState(job: NdviJobResponse) {
    if (job.status === "queued") {
      setJobState({
        status: "queued",
        jobId: job.id,
        progress: job.progress ?? 0,
        message: job.message ?? "Processamento na fila…",
      });
    } else if (job.status === "processing") {
      setJobState({
        status: "processing",
        jobId: job.id,
        progress: job.progress ?? 0,
        message: job.message ?? "Calculando NDVI e cobertura válida…",
      });
    }
  }

  function resetPlot() {
    setPoints([]);
    setDrawing(false);
    setScenes([]);
    setSelectedSceneId("");
    setSearchState({ status: "idle" });
    setJobState({ status: "idle" });
    setRegionalLayerDate(null);
    setSketchState({
      status: "idle",
      message: "Desenhe pelo menos três pontos para criar o croqui.",
    });
  }

  function finishDrawing() {
    if (!drawing) {
      setDrawing(true);
      setSketchState({
        status: "idle",
        message: "Toque no mapa para marcar os vértices da lavoura.",
      });
      return;
    }

    if (!polygon) {
      setSketchState({
        status: "error",
        message:
          geometryIssue ?? "Marque pelo menos três pontos antes de concluir o croqui.",
      });
      return;
    }

    setDrawing(false);
    applyRegionalNdvi();
  }

  function applyRegionalNdvi(requestedDate = dateEnd) {
    if (!polygon) {
      setSketchState({
        status: "error",
        message: "Conclua o desenho da lavoura antes de aplicar o NDVI.",
      });
      return;
    }

    const layerDate = latestStablePublicDate(today, requestedDate.slice(0, 10));
    setRegionalLayerDate(layerDate);
    setActiveLayer("ndvi");
    setDrawing(false);
    setSketchState({
      status: "success",
      message: `NDVI regional de ${formatDate(layerDate)} aplicado ao croqui de ${formatNumber(areaHectares, 2)} ha.`,
    });
    window.requestAnimationFrame(() => {
      mapPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function saveSketch() {
    if (!polygon) return;
    if (!agriculture.selectedPlot) {
      setSketchState({
        status: "error",
        message: "Selecione um talhão cadastrado para salvar o croqui. Você ainda pode baixá-lo.",
      });
      return;
    }

    agriculture.updatePlotBoundary(
      agriculture.selectedPlot.id,
      polygon,
      Number(areaHectares.toFixed(4)),
    );
    setSketchState({
      status: "success",
      message: `Croqui salvo no talhão ${agriculture.selectedPlot.name}.`,
    });
  }

  function downloadSketch() {
    if (!polygon) return;
    const name = agriculture.selectedPlot?.name ?? "croqui-lavoura";
    const document = {
      type: "Feature",
      properties: {
        name,
        crop: agriculture.selectedPlot?.crop ?? "",
        areaHectares: Number(areaHectares.toFixed(4)),
        ndviSource: "NASA MODIS/Terra",
        ndviDate: publicLayerDate,
      },
      geometry: polygon,
    };
    const blob = new Blob([JSON.stringify(document, null, 2)], {
      type: "application/geo+json",
    });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = `${slugify(name)}.geojson`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importBoundary(file: File) {
    try {
      const contents = await file.text();
      const imported = parsePlotBoundary(file.name, contents);
      const importedPoints = pointsFromGeometry(imported.geometry.coordinates[0]);
      const issue = polygonValidationIssue(importedPoints);
      if (issue) throw new Error(issue);
      setPoints(importedPoints);
      setDrawing(false);
      setScenes([]);
      setSelectedSceneId("");
      setSearchState({ status: "idle" });
      setJobState({ status: "idle" });
      setSketchState({
        status: "success",
        message: `Croqui importado: ${formatNumber(imported.areaHectares, 2)} ha. Revise o limite e aplique o NDVI.`,
      });
    } catch (error) {
      setSketchState({
        status: "error",
        message: error instanceof Error ? error.message : "Não foi possível importar o croqui.",
      });
    } finally {
      if (boundaryFileRef.current) boundaryFileRef.current.value = "";
    }
  }

  function createInspection(zone: NdviResult["attentionZones"][number]) {
    if (!currentResult || !agriculture.selectedPlot) {
      setSketchState({
        status: "error",
        message: "Selecione e salve um talhão antes de criar a vistoria.",
      });
      return;
    }
    onCreateInspection({
      type: "Inspeção",
      title: `Vistoria NDVI — ${zone.label}`,
      date: today,
      notes: [
        `Zona: ${formatNumber(zone.hectares, 2)} ha.`,
        `Coordenadas: ${formatCoordinate(zone.centroid)}.`,
        `Imagem: ${formatDate(currentResult.acquiredAt)} (${currentResult.sensor}).`,
        zone.reason,
        "Confirmar em campo e cruzar com solo, folha, clima, manejo e fotografias.",
      ].join(" "),
      status: "planejada",
      cost: 0,
      quantity: "",
      unit: "",
    });
    onNavigate("caderno");
  }

  function handleCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationState({
        status: "error",
        message: "Este navegador não oferece localização.",
      });
      return;
    }

    setLocationState({
      status: "locating",
      message: "Aguardando sua autorização para localizar o mapa…",
    });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation([position.coords.longitude, position.coords.latitude]);
        setActiveLayer("ndvi");
        setLocationState({
          status: "success",
          message: `Localização encontrada com precisão aproximada de ${Math.round(position.coords.accuracy)} m.`,
        });
      },
      (error) => {
        const message =
          error.code === error.PERMISSION_DENIED
            ? "Permissão de localização não concedida."
            : error.code === error.TIMEOUT
              ? "A localização demorou demais. Tente novamente em área aberta."
              : "Não foi possível obter a localização atual.";
        setLocationState({ status: "error", message });
      },
      {
        enableHighAccuracy: true,
        maximumAge: 60_000,
        timeout: 12_000,
      },
    );
  }

  return (
    <div className="page-stack ndvi-page">
      <section className="ndvi-page-header">
        <button className="ndvi-back-button" type="button" onClick={() => onNavigate("modulos")}>
          <ArrowLeft size={16} aria-hidden="true" />
          Módulos
        </button>
        <div className="ndvi-heading-row">
          <div className="ndvi-title-icon"><Satellite size={27} aria-hidden="true" /></div>
          <div>
            <span className="eyebrow">Sensoriamento remoto</span>
            <h1>Análise NDVI por Satélite</h1>
            <p>
              Monitore o vigor espectral da cultura com imagens Sentinel‑2 L2A gratuitas,
              histórico comparável e zonas para conferência em campo.
            </p>
          </div>
          <div className="ndvi-source-stack">
            <div className="ndvi-source-badge">
              <CheckCircle2 size={16} aria-hidden="true" />
              <span><strong>Imagem NDVI ativa</strong><small>NASA MODIS · 250 m</small></span>
            </div>
            <div className="ndvi-source-badge" data-secondary="true">
              <Satellite size={16} aria-hidden="true" />
              <span><strong>Detalhamento</strong><small>Copernicus Sentinel‑2 · 10 m</small></span>
            </div>
          </div>
        </div>
      </section>

      <section className="ndvi-workspace" aria-label="Configuração e mapa NDVI">
        <aside className="ndvi-controls">
          <div className="ndvi-panel-heading">
            <span className="ndvi-step">1</span>
            <div><strong>Área e período</strong><small>Defina onde e quando pesquisar</small></div>
          </div>

          <label>
            Propriedade
            <select
              value={agriculture.selectedProperty?.id ?? "area-avulsa"}
              aria-label="Propriedade"
              onChange={(event) => {
                if (event.target.value !== "area-avulsa") {
                  agriculture.selectProperty(event.target.value);
                }
              }}
            >
              <option value="area-avulsa">Área avulsa — sem cadastro</option>
              {agriculture.state.properties.map((property) => (
                <option value={property.id} key={property.id}>{property.name}</option>
              ))}
            </select>
          </label>

          <button
            className="ndvi-location-button"
            type="button"
            onClick={handleCurrentLocation}
            disabled={locationState.status === "locating"}
          >
            {locationState.status === "locating" ? (
              <LoaderCircle className="spin" size={18} aria-hidden="true" />
            ) : (
              <Navigation size={18} aria-hidden="true" />
            )}
            {locationState.status === "locating" ? "Localizando…" : "Usar minha localização"}
          </button>
          <small
            className="ndvi-location-status"
            data-status={locationState.status}
            role={locationState.status === "error" ? "alert" : "status"}
          >
            {locationState.message}
          </small>

          <label>
            Talhão
            <select
              value={agriculture.selectedPlot?.id ?? "mapa"}
              aria-label="Talhão"
              onChange={(event) => {
                if (event.target.value !== "mapa") {
                  const plot = agriculture.state.plots.find(
                    (candidate) => candidate.id === event.target.value,
                  );
                  agriculture.selectPlot(event.target.value);
                  setPoints(pointsFromGeometry(plot?.geometry?.coordinates[0]));
                  setScenes([]);
                  setSelectedSceneId("");
                  setSearchState({ status: "idle" });
                  setJobState({ status: "idle" });
                }
              }}
            >
              <option value="mapa">Polígono desenhado no mapa</option>
              {agriculture.state.plots
                .filter((plot) => plot.propertyId === agriculture.selectedProperty?.id)
                .map((plot) => (
                  <option value={plot.id} key={plot.id}>{plot.name} · {plot.crop}</option>
                ))}
            </select>
          </label>

          <div className="ndvi-date-grid">
            <label>
              Data inicial
              <input
                type="date"
                value={dateStart}
                max={dateEnd}
                onChange={(event) => setDateStart(event.target.value)}
              />
            </label>
            <label>
              Data final
              <input
                type="date"
                value={dateEnd}
                min={dateStart}
                max={today}
                onChange={(event) => setDateEnd(event.target.value)}
              />
            </label>
          </div>

          <label>
            Nuvens máximas na cena
            <span className="ndvi-range-value">{maximumCloudCover}%</span>
            <input
              type="range"
              min="0"
              max="90"
              step="5"
              value={maximumCloudCover}
              onChange={(event) => setMaximumCloudCover(Number(event.target.value))}
            />
            <small>
              Este é só o pré-filtro da cena. A cobertura válida dentro do talhão é calculada
              depois da máscara de nuvens.
            </small>
          </label>

          <div className="ndvi-draw-actions">
            <button
              className="primary-button"
              type="button"
              data-active={drawing}
              onClick={finishDrawing}
            >
              <MapPinned size={17} aria-hidden="true" />
              {drawing ? "Concluir e aplicar NDVI" : points.length ? "Editar croqui" : "Desenhar croqui"}
            </button>
            <button
              className="ndvi-icon-action"
              type="button"
              onClick={() => setPoints((current) => current.slice(0, -1))}
              disabled={points.length === 0}
              aria-label="Desfazer último ponto"
              title="Desfazer último ponto"
            >
              <Undo2 size={17} />
            </button>
            <button
              className="ndvi-icon-action"
              type="button"
              onClick={resetPlot}
              disabled={points.length === 0}
              aria-label="Limpar talhão"
              title="Limpar talhão"
            >
              <Trash2 size={17} />
            </button>
          </div>

          <input
            ref={boundaryFileRef}
            className="ndvi-boundary-input"
            type="file"
            accept=".geojson,.json,.kml,application/geo+json,application/vnd.google-earth.kml+xml"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importBoundary(file);
            }}
          />
          <button
            className="ndvi-import-button"
            type="button"
            onClick={() => boundaryFileRef.current?.click()}
          >
            <Upload size={17} aria-hidden="true" />
            Importar KML ou GeoJSON
          </button>

          <div className="ndvi-area-summary" data-ready={Boolean(polygon)}>
            <Focus size={18} aria-hidden="true" />
            <span>
              <small>Área delimitada</small>
              <strong>{polygon ? `${formatNumber(areaHectares, 2)} ha` : "Aguardando polígono"}</strong>
            </span>
            <span><small>Vértices</small><strong>{points.length}</strong></span>
          </div>

          {geometryIssue && points.length >= 3 && (
            <div className="ndvi-geometry-warning" role="alert">
              <TriangleAlert size={16} aria-hidden="true" />
              <span>{geometryIssue}</span>
            </div>
          )}

          {polygon && areaHectares < 6.25 && (
            <div className="ndvi-resolution-warning">
              <TriangleAlert size={16} aria-hidden="true" />
              <span>
                <strong>Talhão pequeno para o NDVI regional de 250 m.</strong>
                Use o Sentinel‑2 detalhado de 10 m antes de interpretar diferenças internas.
              </span>
            </div>
          )}

          {polygon && (
            <div className="ndvi-sketch-actions">
              <button type="button" onClick={() => applyRegionalNdvi()}>
                <Satellite size={17} aria-hidden="true" />
                Aplicar NDVI ao croqui
              </button>
              <button type="button" onClick={saveSketch}>
                <Save size={17} aria-hidden="true" />
                Salvar croqui
              </button>
              <button type="button" onClick={downloadSketch}>
                <Download size={17} aria-hidden="true" />
                Baixar GeoJSON
              </button>
            </div>
          )}

          <small
            className="ndvi-sketch-status"
            data-status={sketchState.status}
            role={sketchState.status === "error" ? "alert" : "status"}
          >
            {sketchState.message}
          </small>

          <button
            className="ndvi-search-button"
            type="button"
            onClick={handleSceneSearch}
            disabled={!polygon || searchState.status === "searching"}
          >
            {searchState.status === "searching" ? (
              <LoaderCircle className="spin" size={18} aria-hidden="true" />
            ) : (
              <Search size={18} aria-hidden="true" />
            )}
            Buscar imagens gratuitas
          </button>
        </aside>

        <div className="ndvi-map-panel" data-fullscreen={fullscreen} ref={mapPanelRef}>
          <div className="ndvi-map-toolbar">
            <div className="ndvi-layer-toggle" aria-label="Camada visível">
              <button
                type="button"
                data-active={activeLayer === "true-color"}
                onClick={() => setActiveLayer("true-color")}
              >
                Cor natural
              </button>
              <button
                type="button"
                data-active={activeLayer === "ndvi"}
                onClick={() => setActiveLayer("ndvi")}
              >
                NDVI
              </button>
            </div>
            <label className="ndvi-opacity">
              Opacidade
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={opacity}
                onChange={(event) => setOpacity(Number(event.target.value))}
              />
            </label>
            <button
              className="ndvi-icon-action"
              type="button"
              onClick={() => setFullscreen((current) => !current)}
              aria-label={fullscreen ? "Sair da tela cheia" : "Abrir mapa em tela cheia"}
            >
              <Maximize2 size={17} />
            </button>
          </div>

          <div className="ndvi-map-canvas">
            <NdviMap
              points={points}
              drawing={drawing}
              fullscreen={fullscreen}
              activeLayer={activeLayer}
              opacity={opacity}
              ndviLayer={currentResult?.ndviLayer}
              trueColorLayer={currentResult?.trueColorLayer}
              publicLayerDate={publicLayerDate}
              currentLocation={currentLocation}
              onAddPoint={(position) => setPoints((current) => [...current, position])}
              onMovePoint={(index, position) =>
                setPoints((current) =>
                  current.map((point, pointIndex) => (pointIndex === index ? position : point)),
                )
              }
            />
            {points.length === 0 && (
              <div className="ndvi-map-guide">
                <MapPinned size={18} aria-hidden="true" />
                <span><strong>NDVI público visível</strong> Localize-se ou desenhe o talhão para pesquisar Sentinel‑2.</span>
              </div>
            )}
            {drawing && (
              <div className="ndvi-drawing-status">
                <span className="pulse-dot" />
                Modo desenho ativo
              </div>
            )}
          </div>

          <div className="ndvi-legend" aria-label="Legenda numérica do NDVI">
            <span>-1,0</span>
            <div aria-hidden="true" />
            <span>0,2</span><span>0,4</span><span>0,6</span><span>0,8</span><span>1,0</span>
          </div>

          <div className="ndvi-map-metadata">
            <span><Satellite size={14} />{currentResult?.sensor ?? "NASA MODIS/Terra"}</span>
            <span><CalendarDays size={14} />{currentResult ? formatDate(currentResult.acquiredAt) : formatDate(publicLayerDate)}</span>
            <span><SquareStack size={14} />{currentResult ? `${currentResult.resolutionMeters} m` : "250 m · visão regional"}</span>
            <span><Cloud size={14} />{currentResult ? `${formatNumber(100 - currentResult.validCoveragePercentage, 1)}% descartado` : "Composição móvel de 8 dias"}</span>
            {currentResult && <span><CheckCircle2 size={14} />Processado em {formatDate(currentResult.processedAt)}</span>}
          </div>
        </div>
      </section>

      <section className="ndvi-scene-section" aria-labelledby="ndvi-scenes-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Imagens disponíveis</span>
            <h2 id="ndvi-scenes-title">Selecione a melhor aquisição</h2>
            <p>Datas reais do catálogo; nenhuma imagem ou métrica é simulada.</p>
          </div>
          <a className="text-button" href={getStacRootUrl()} target="_blank" rel="noreferrer">
            Ver catálogo oficial <ExternalLink size={15} aria-hidden="true" />
          </a>
        </div>

        {searchState.status !== "idle" && (
          <div className="ndvi-status" data-status={searchState.status} role="status">
            {searchState.status === "searching" && <LoaderCircle className="spin" size={18} />}
            {searchState.status === "success" && <CheckCircle2 size={18} />}
            {searchState.status === "error" && <AlertCircle size={18} />}
            <span>{searchState.message}</span>
          </div>
        )}

        {scenes.length > 0 ? (
          <div className="ndvi-scene-layout">
            <div className="ndvi-scene-list" role="radiogroup" aria-label="Imagens Sentinel-2">
              {scenes.slice(0, 12).map((scene, index) => {
                const selected = scene.id === selectedSceneId;
                return (
                  <button
                    className="ndvi-scene-card"
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    data-selected={selected}
                    key={scene.id}
                    onClick={() => {
                      setSelectedSceneId(scene.id);
                      setRegionalLayerDate(scene.datetime.slice(0, 10));
                    }}
                  >
                    <span className="ndvi-scene-rank">{index === 0 ? <Sparkles size={15} /> : index + 1}</span>
                    <span>
                      <strong>{formatDate(scene.datetime)}</strong>
                      <small>{scene.platform} · {scene.resolutionMeters} m</small>
                    </span>
                    <span className="ndvi-cloud-value">
                      <Cloud size={14} />
                      <strong>{scene.sceneCloudCover === null ? "—" : `${formatNumber(scene.sceneCloudCover, 1)}%`}</strong>
                      <small>na cena</small>
                    </span>
                    <ChevronRight size={17} aria-hidden="true" />
                  </button>
                );
              })}
            </div>

            <aside className="ndvi-process-card">
              <div className="ndvi-panel-heading">
                <span className="ndvi-step">2</span>
                <div><strong>Processar imagem</strong><small>Recorte, máscara e índice</small></div>
              </div>
              {selectedScene && (
                <dl>
                  <div><dt>Aquisição</dt><dd>{formatDateTime(selectedScene.datetime)}</dd></div>
                  <div><dt>Produto</dt><dd>Sentinel‑2 L2A</dd></div>
                  <div><dt>Bandas</dt><dd>B08 (NIR) + B04 (vermelho)</dd></div>
                  <div><dt>Qualidade</dt><dd>SCL por pixel no talhão</dd></div>
                  <div><dt>Fórmula</dt><dd>(B08 − B04) / (B08 + B04)</dd></div>
                </dl>
              )}

              {!processingApiAvailable && (
                <div className="ndvi-connector-notice">
                  <TriangleAlert size={18} aria-hidden="true" />
                  <span>
                    <strong>Detalhamento Sentinel‑2 ainda não conectado</strong>
                    <small>
                      A imagem NDVI regional da NASA já está visível no mapa. Estatísticas e
                      recorte Sentinel‑2 de 10 m exigem o serviço seguro descrito na documentação.
                    </small>
                  </span>
                </div>
              )}

              <button
                className="ndvi-regional-button"
                type="button"
                disabled={!polygon}
                onClick={() => applyRegionalNdvi(selectedScene?.datetime ?? dateEnd)}
              >
                <Satellite size={18} aria-hidden="true" />
                Ver NDVI regional no croqui
              </button>

              {(jobState.status === "submitting" ||
                jobState.status === "queued" ||
                jobState.status === "processing") && (
                <div className="ndvi-progress" role="status">
                  <div>
                    <span>{jobState.message}</span>
                    <strong>
                      {jobState.status === "submitting" ? "…" : `${Math.round(jobState.progress)}%`}
                    </strong>
                  </div>
                  <progress
                    max="100"
                    value={jobState.status === "submitting" ? undefined : jobState.progress}
                  />
                  <button type="button" onClick={handleCancelProcessing}>Cancelar</button>
                </div>
              )}

              {(jobState.status === "error" || jobState.status === "cancelled") && (
                <div className="ndvi-status" data-status="error" role="alert">
                  <CircleOff size={17} />
                  <span>{jobState.message}</span>
                </div>
              )}

              <button
                className="ndvi-process-button"
                type="button"
                disabled={!selectedScene || !processingApiAvailable || ["submitting", "queued", "processing"].includes(jobState.status)}
                onClick={handleProcessing}
              >
                <Satellite size={18} aria-hidden="true" />
                Processar Sentinel‑2 detalhado
              </button>
              <small className="ndvi-cost-note">
                Catálogo gratuito. O processamento deve usar cota gratuita ou infraestrutura
                própria; nenhuma API paga é acionada silenciosamente.
              </small>
            </aside>
          </div>
        ) : searchState.status === "idle" ? (
          <div className="ndvi-empty-state">
            <Layers3 size={28} aria-hidden="true" />
            <strong>Nenhuma busca realizada</strong>
            <span>Desenhe o talhão, ajuste o período e consulte o catálogo Copernicus.</span>
          </div>
        ) : null}
      </section>

      <section className="ndvi-results-section" aria-labelledby="ndvi-results-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Resultado rastreável</span>
            <h2 id="ndvi-results-title">Indicadores do talhão</h2>
            <p>Estatísticas, distribuição e cobertura válida calculadas somente sobre pixels aceitos.</p>
          </div>
          <button
            className="text-button"
            type="button"
            disabled={!currentResult}
            onClick={() => window.print()}
          >
            Exportar PDF <Download size={15} aria-hidden="true" />
          </button>
        </div>

        {currentResult ? (
          <>
            <div className="ndvi-metrics-grid">
              <NdviMetric label="NDVI médio" value={formatNumber(currentResult.statistics.mean, 3)} detail={`Mediana ${formatNumber(currentResult.statistics.median, 3)}`} />
              <NdviMetric label="Mínimo / máximo" value={`${formatNumber(currentResult.statistics.minimum, 2)} / ${formatNumber(currentResult.statistics.maximum, 2)}`} detail={`Desvio ${formatNumber(currentResult.statistics.standardDeviation, 3)}`} />
              <NdviMetric label="Cobertura válida" value={`${formatNumber(currentResult.validCoveragePercentage, 1)}%`} detail={`${formatNumber(currentResult.validAreaHectares, 2)} ha válidos`} warning={!hasSufficientCoverage(currentResult.validCoveragePercentage, currentResult.minimumValidCoveragePercentage)} />
              <NdviMetric label="Área descartada" value={`${formatNumber(currentResult.discardedAreaHectares, 2)} ha`} detail="Nuvem, sombra, cirrus ou NoData" />
              <NdviMetric label="Imagem" value={formatDate(currentResult.acquiredAt)} detail={`${daysSince(currentResult.acquiredAt)} dias desde a aquisição`} />
              {currentResult.statistics.uniformityIndex !== undefined && (
                <NdviMetric
                  label="Uniformidade espacial"
                  value={`${formatNumber(currentResult.statistics.uniformityIndex, 0)}/100`}
                  detail="Homogeneidade do NDVI, não produtividade"
                  warning={currentResult.statistics.uniformityIndex < 60}
                />
              )}
              {currentResult.statistics.coefficientOfVariation !== undefined && (
                <NdviMetric
                  label="Coeficiente de variação"
                  value={`${formatNumber(currentResult.statistics.coefficientOfVariation, 1)}%`}
                  detail={`P10 ${formatNumber(currentResult.statistics.percentile10 ?? 0, 2)} · P90 ${formatNumber(currentResult.statistics.percentile90 ?? 0, 2)}`}
                />
              )}
              {currentResult.quality && (
                <NdviMetric
                  label="Confiança"
                  value={capitalize(currentResult.quality.confidence)}
                  detail={`${currentResult.quality.validPixelCount.toLocaleString("pt-BR")} pixels válidos`}
                  warning={currentResult.quality.confidence === "insuficiente"}
                />
              )}
            </div>

            {currentResult.quality && (
              <div className="ndvi-quality-panel">
                <div>
                  <strong>Qualidade dentro do talhão</strong>
                  <small>Avaliação por pixel com a camada SCL, não pela nuvem geral da cena.</small>
                </div>
                <span><strong>{formatNumber(currentResult.quality.cloudPercentage, 1)}%</strong><small>Nuvens/cirrus</small></span>
                <span><strong>{formatNumber(currentResult.quality.shadowPercentage, 1)}%</strong><small>Sombras</small></span>
                <span><strong>{formatNumber(currentResult.quality.noDataPercentage, 1)}%</strong><small>Inválido/NoData</small></span>
                <span><strong>{formatNumber(currentResult.quality.waterPercentage, 1)}%</strong><small>Água removida</small></span>
              </div>
            )}

            <div className="ndvi-result-grid">
              <article className="ndvi-distribution-card">
                <div className="ndvi-card-title">
                  <span><Layers3 size={18} /></span>
                  <div><strong>Distribuição por classe</strong><small>Percentual e hectares válidos</small></div>
                </div>
                <div className="ndvi-classification-toggle" aria-label="Método de classificação">
                  <button
                    type="button"
                    data-active={classificationMode === "relative"}
                    onClick={() => setClassificationMode("relative")}
                  >
                    Relativa ao talhão
                  </button>
                  <button
                    type="button"
                    data-active={classificationMode === "general"}
                    onClick={() => setClassificationMode("general")}
                  >
                    Faixas gerais
                  </button>
                </div>
                <p className="ndvi-classification-note">
                  {classificationMode === "relative"
                    ? "Modo recomendado: compara cada pixel com a distribuição do próprio talhão."
                    : "Faixas apenas referenciais; não representam diagnóstico agronômico."}
                </p>
                <div className="ndvi-class-chart">
                  {displayedClasses.map((item) => (
                    <div key={item.id}>
                      <span className="ndvi-class-color" style={{ backgroundColor: item.color }} />
                      <span><strong>{item.label}</strong><small>{formatNumber(item.hectares, 2)} ha</small></span>
                      <div><i style={{ width: `${Math.max(item.percentage, 1)}%`, backgroundColor: item.color }} /></div>
                      <strong>{formatNumber(item.percentage, 1)}%</strong>
                    </div>
                  ))}
                </div>
              </article>

              <article className="ndvi-interpretation-card">
                <div className="ndvi-card-title">
                  <span><ShieldCheck size={18} /></span>
                  <div><strong>Leitura responsável</strong><small>Triagem, não diagnóstico isolado</small></div>
                </div>
                <p>{responsibleInterpretation(currentResult.validCoveragePercentage, currentResult.statistics.mean)}</p>
                <ul>
                  <li>Vistoriar primeiro as zonas persistentes de menor índice.</li>
                  <li>Cruzar com clima, solo, análise foliar e fotografias de campo.</li>
                  <li>Registrar a observação antes de definir qualquer intervenção.</li>
                  {agriculture.selectedPlot?.crop === "Café" && (
                    <li>
                      Em café jovem ou espaçado, considere solo e vegetação das entrelinhas;
                      o NDVI não mede produtividade diretamente.
                    </li>
                  )}
                </ul>
              </article>
            </div>

            <article className="ndvi-zones-card">
              <div className="ndvi-card-title">
                <span><Layers3 size={18} /></span>
                <div>
                  <strong>Zonas de manejo</strong>
                  <small>Cinco faixas de vigor com orientação por área</small>
                </div>
              </div>
              <div className="ndvi-zones-list">
                {managementZones.map((zone) => (
                  <div key={zone.letter} className="ndvi-zone-row">
                    <span className="ndvi-zone-badge" style={{ backgroundColor: zone.color }}>
                      {zone.letter}
                    </span>
                    <div className="ndvi-zone-head">
                      <strong>
                        {zone.label}
                        <em>
                          NDVI {zone.ndviMin.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          {zone.letter === "A" ? "+" : `–${zone.ndviMax.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                        </em>
                      </strong>
                      <span className="ndvi-zone-figures">
                        {formatNumber(zone.percentage, 1)}% · {formatNumber(zone.hectares, 2)} ha
                      </span>
                    </div>
                    <div className="ndvi-zone-bar">
                      <i style={{ width: `${Math.max(zone.percentage, 1)}%`, backgroundColor: zone.color }} />
                    </div>
                    <p className="ndvi-zone-guidance">{zone.guidance}</p>
                  </div>
                ))}
              </div>
              {zonesDiagnosisText && <p className="ndvi-zones-diagnosis">{zonesDiagnosisText}</p>}
              <p className="ndvi-zones-note">
                {ZONES_SOIL_NOTE}{" "}
                <a href="./agryn.html?tab=solo">Vincular análise de solo</a>
              </p>
            </article>
          </>
        ) : (
          <div className="ndvi-empty-state ndvi-empty-result">
            <SquareStack size={30} aria-hidden="true" />
            <strong>Sem resultado processado</strong>
            <span>
              A AGRYN não exibe mapas coloridos ou indicadores fictícios. Conecte o processador
              geoespacial para calcular uma cena real.
            </span>
          </div>
        )}
      </section>

      <section className="ndvi-history-section" aria-labelledby="ndvi-history-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Evolução temporal</span>
            <h2 id="ndvi-history-title">Histórico e comparação</h2>
            <p>Compare apenas processamentos salvos e mantenha diferenças de sensor e qualidade visíveis.</p>
          </div>
          <button
            className="secondary-button ndvi-play-button"
            type="button"
            disabled={history.length < 2}
            onClick={() => setTimelinePlaying((current) => !current)}
          >
            {timelinePlaying ? <Pause size={16} /> : <Play size={16} />}
            {timelinePlaying ? "Pausar evolução" : "Animar evolução"}
          </button>
        </div>

        {history.length > 0 ? (
          <div className="ndvi-history-grid">
            <div className="ndvi-timeline">
              {history.map((result) => (
                <button
                  type="button"
                  key={result.id}
                  data-current={currentResult?.id === result.id}
                  onClick={() => setJobState({ status: "completed", jobId: result.id, result })}
                >
                  <span />
                  <strong>{formatDate(result.acquiredAt)}</strong>
                  <small>NDVI {formatNumber(result.statistics.mean, 3)}</small>
                  <small>{formatNumber(result.validCoveragePercentage, 1)}% válido</small>
                </button>
              ))}
            </div>

            <article className="ndvi-compare-card">
              <div className="ndvi-card-title">
                <span><RotateCcw size={18} /></span>
                <div><strong>Comparar duas datas</strong><small>Mesma área, qualidade sempre visível</small></div>
              </div>
              <div className="ndvi-compare-selects">
                <label>Data A<select value={compareLeft} onChange={(event) => setCompareLeft(event.target.value)}><option value="">Selecione</option>{history.map((item) => <option key={item.id} value={item.id}>{formatDate(item.acquiredAt)}</option>)}</select></label>
                <label>Data B<select value={compareRight} onChange={(event) => setCompareRight(event.target.value)}><option value="">Selecione</option>{history.map((item) => <option key={item.id} value={item.id}>{formatDate(item.acquiredAt)}</option>)}</select></label>
              </div>
              {compareLeftResult && compareRightResult ? (
                <ComparisonSummary left={compareLeftResult} right={compareRightResult} />
              ) : (
                <p>Selecione duas datas processadas para calcular a tendência relativa.</p>
              )}
            </article>
          </div>
        ) : (
          <div className="ndvi-empty-state">
            <CalendarDays size={28} aria-hidden="true" />
            <strong>Histórico vazio</strong>
            <span>Os processamentos reais salvos neste dispositivo aparecerão aqui.</span>
          </div>
        )}
      </section>

      <section className="ndvi-attention-section" aria-labelledby="ndvi-attention-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Conferência em campo</span>
            <h2 id="ndvi-attention-title">Zonas de atenção</h2>
            <p>Áreas de menor índice, queda relativa ou comportamento persistente — nunca causas presumidas.</p>
          </div>
        </div>
        {currentResult?.attentionZones.length ? (
          <div className="ndvi-zone-grid">
            {currentResult.attentionZones.map((zone) => (
              <article key={zone.id}>
                <span><TriangleAlert size={18} /></span>
                <div><strong>{zone.label}</strong><p>{zone.reason}</p><small>{formatNumber(zone.hectares, 2)} ha · {formatCoordinate(zone.centroid)}</small></div>
                <button
                  type="button"
                  disabled={!agriculture.selectedPlot}
                  onClick={() => createInspection(zone)}
                  title={
                    agriculture.selectedPlot
                      ? "Criar vistoria no caderno de campo"
                      : "Selecione um talhão para criar a vistoria"
                  }
                >
                  Criar vistoria <ChevronRight size={15} />
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="ndvi-empty-state compact">
            <MapPinned size={25} aria-hidden="true" />
            <strong>Nenhuma zona calculada</strong>
            <span>As zonas só serão criadas a partir de pixels reais e cobertura válida suficiente.</span>
          </div>
        )}
      </section>

      <section className="ndvi-transparency-note">
        <ShieldCheck size={20} aria-hidden="true" />
        <div>
          <strong>Transparência do módulo</strong>
          <p>
            A busca consulta o STAC público do Copernicus. O processamento raster, a máscara SCL,
            as métricas e os mapas dependem de um serviço geoespacial configurado pelo operador.
            Landsat 8/9 está previsto como contingência arquitetural e ainda não está habilitado
            nesta interface. As zonas processadas podem gerar vistorias no caderno de campo;
            rotas e anexos fotográficos ainda dependem da próxima integração operacional.
          </p>
        </div>
        <a href="./ndvi-integration.html" target="_blank">
          Ver integração <ExternalLink size={14} />
        </a>
      </section>
    </div>
  );
}

function NdviMetric({
  label,
  value,
  detail,
  warning = false,
}: {
  label: string;
  value: string;
  detail: string;
  warning?: boolean;
}) {
  return (
    <article className="ndvi-metric" data-warning={warning}>
      <small>{label}</small>
      <strong>{value}</strong>
      <span>{detail}</span>
    </article>
  );
}

function ComparisonSummary({ left, right }: { left: NdviResult; right: NdviResult }) {
  const difference = right.statistics.mean - left.statistics.mean;
  const rising = difference >= 0;
  const change =
    difference <= -0.1
      ? "Queda muito significativa"
      : difference <= -0.04
        ? "Queda moderada"
        : difference < 0.04
          ? "Estável"
          : difference < 0.1
            ? "Aumento moderado"
            : "Aumento significativo";
  const comparableSensor = left.sensor === right.sensor;

  return (
    <div className="ndvi-comparison-summary" data-rising={rising}>
      {rising ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
      <span>
        <strong>{difference >= 0 ? "+" : ""}{formatNumber(difference, 3)} NDVI médio</strong>
        <small>{change}. A causa de qualquer mudança deve ser confirmada em campo.</small>
        <small>
          {left.sensor} {left.resolutionMeters} m → {right.sensor} {right.resolutionMeters} m.
          {comparableSensor
            ? " Diferenças de qualidade, sazonalidade e manejo devem ser consideradas."
            : " Sensores diferentes reduzem a comparabilidade direta."}
        </small>
      </span>
    </div>
  );
}

function pointsFromGeometry(ring: Position[] | undefined): Position[] {
  if (!ring || ring.length < 4) return [];
  const last = ring.length - 1;
  return ring[0][0] === ring[last][0] && ring[0][1] === ring[last][1]
    ? ring.slice(0, -1)
    : [...ring];
}

function formatInputDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatNumber(value: number, digits: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function daysSince(value: string): number {
  const milliseconds = Date.now() - new Date(value).getTime();
  return Math.max(0, Math.floor(milliseconds / 86_400_000));
}

function formatCoordinate([longitude, latitude]: Position): string {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

function slugify(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "croqui-lavoura"
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toLocaleUpperCase("pt-BR") + value.slice(1);
}
