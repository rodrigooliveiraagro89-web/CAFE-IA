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
  Pause,
  Play,
  RotateCcw,
  Satellite,
  Search,
  ShieldCheck,
  Sparkles,
  SquareStack,
  Trash2,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AppView } from "../../app/navigation";
import {
  closePolygon,
  hasSufficientCoverage,
  polygonAreaHectares,
  responsibleInterpretation,
} from "./domain";
import { NdviMap } from "./NdviMap";
import {
  cancelNdviJob,
  getProcessingApiUrl,
  processNdvi,
} from "./processingClient";
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
};

type SearchState =
  | { status: "idle" }
  | { status: "searching"; message: string }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const HISTORY_KEY = "agryn.ndvi.history.v1";
const minimumValidCoveragePercentage = 70;

export function NdviModule({ onNavigate }: NdviModuleProps) {
  const today = useMemo(() => formatInputDate(new Date()), []);
  const ninetyDaysAgo = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 90);
    return formatInputDate(date);
  }, []);
  const [points, setPoints] = useState<Position[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [dateStart, setDateStart] = useState(ninetyDaysAgo);
  const [dateEnd, setDateEnd] = useState(today);
  const [maximumCloudCover, setMaximumCloudCover] = useState(30);
  const [scenes, setScenes] = useState<NdviScene[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState("");
  const [searchState, setSearchState] = useState<SearchState>({ status: "idle" });
  const [jobState, setJobState] = useState<NdviJobState>({ status: "idle" });
  const [history, setHistory] = useState<NdviResult[]>(loadHistory);
  const [activeLayer, setActiveLayer] = useState<"true-color" | "ndvi">("ndvi");
  const [opacity, setOpacity] = useState(0.78);
  const [fullscreen, setFullscreen] = useState(false);
  const [compareLeft, setCompareLeft] = useState("");
  const [compareRight, setCompareRight] = useState("");
  const [timelinePlaying, setTimelinePlaying] = useState(false);
  const processingAbortController = useRef<AbortController | null>(null);
  const searchAbortController = useRef<AbortController | null>(null);

  const polygon = useMemo(() => {
    try {
      return closePolygon(points);
    } catch {
      return null;
    }
  }, [points]);
  const areaHectares = useMemo(
    () => (polygon ? polygonAreaHectares(polygon) : 0),
    [polygon],
  );
  const selectedScene = scenes.find((scene) => scene.id === selectedSceneId) ?? null;
  const currentResult =
    jobState.status === "completed" ? jobState.result : history[0] ?? null;
  const processingApiAvailable = Boolean(getProcessingApiUrl());
  const compareLeftResult = history.find((result) => result.id === compareLeft) ?? null;
  const compareRightResult = history.find((result) => result.id === compareRight) ?? null;

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
          plotId: "area-avulsa",
          minimumValidCoveragePercentage,
        },
        updateJobState,
        controller.signal,
      );
      const nextHistory = [result, ...history.filter((item) => item.id !== result.id)].slice(0, 24);
      setHistory(nextHistory);
      saveHistory(nextHistory);
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
              Monitore o vigor espectral do café com imagens Sentinel‑2 L2A gratuitas,
              histórico comparável e zonas para conferência em campo.
            </p>
          </div>
          <div className="ndvi-source-badge">
            <CheckCircle2 size={16} aria-hidden="true" />
            <span><strong>Fonte real</strong><small>Copernicus Data Space</small></span>
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
            <select defaultValue="area-avulsa" aria-label="Propriedade">
              <option value="area-avulsa">Área avulsa — sem cadastro</option>
            </select>
          </label>

          <label>
            Talhão
            <select defaultValue="mapa" aria-label="Talhão">
              <option value="mapa">Polígono desenhado no mapa</option>
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
              onClick={() => setDrawing((current) => !current)}
            >
              <MapPinned size={17} aria-hidden="true" />
              {drawing ? "Concluir desenho" : points.length ? "Continuar desenho" : "Desenhar talhão"}
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

          <div className="ndvi-area-summary" data-ready={Boolean(polygon)}>
            <Focus size={18} aria-hidden="true" />
            <span>
              <small>Área delimitada</small>
              <strong>{polygon ? `${formatNumber(areaHectares, 2)} ha` : "Aguardando polígono"}</strong>
            </span>
            <span><small>Vértices</small><strong>{points.length}</strong></span>
          </div>

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

        <div className="ndvi-map-panel" data-fullscreen={fullscreen}>
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
              onAddPoint={(position) => setPoints((current) => [...current, position])}
              onMovePoint={(index, position) =>
                setPoints((current) =>
                  current.map((point, pointIndex) => (pointIndex === index ? position : point)),
                )
              }
            />
            {points.length === 0 && (
              <div className="ndvi-map-empty">
                <MapPinned size={26} aria-hidden="true" />
                <strong>Delimite o talhão</strong>
                <span>Ative “Desenhar talhão” e toque no mapa para marcar os vértices.</span>
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
            <span><Satellite size={14} />{currentResult?.sensor ?? "Sentinel‑2 L2A"}</span>
            <span><CalendarDays size={14} />{currentResult ? formatDate(currentResult.acquiredAt) : "Selecione uma data"}</span>
            <span><SquareStack size={14} />{currentResult ? `${currentResult.resolutionMeters} m` : "Até 10 m"}</span>
            <span><Cloud size={14} />{currentResult ? `${formatNumber(100 - currentResult.validCoveragePercentage, 1)}% descartado` : "Máscara SCL"}</span>
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
                    onClick={() => setSelectedSceneId(scene.id)}
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
                    <strong>Processador ainda não conectado</strong>
                    <small>
                      A busca real está ativa. O mapa NDVI e as métricas ficam bloqueados até
                      configurar o serviço seguro descrito na documentação.
                    </small>
                  </span>
                </div>
              )}

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
                Processar NDVI
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
            </div>

            <div className="ndvi-result-grid">
              <article className="ndvi-distribution-card">
                <div className="ndvi-card-title">
                  <span><Layers3 size={18} /></span>
                  <div><strong>Distribuição por classe</strong><small>Percentual e hectares válidos</small></div>
                </div>
                <div className="ndvi-class-chart">
                  {currentResult.classes.map((item) => (
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
                </ul>
              </article>
            </div>
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
                <button type="button" disabled title="Integração com tarefas de campo pendente">
                  Vistoria pendente <ChevronRight size={15} />
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
            nesta interface. Comparação visual em divisor, rotas de vistoria e vínculo com
            alertas também dependem do próximo serviço operacional.
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

  return (
    <div className="ndvi-comparison-summary" data-rising={rising}>
      {rising ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
      <span>
        <strong>{difference >= 0 ? "+" : ""}{formatNumber(difference, 3)} NDVI médio</strong>
        <small>
          {left.sensor} {left.resolutionMeters} m → {right.sensor} {right.resolutionMeters} m.
          Diferenças de qualidade e cobertura devem ser consideradas.
        </small>
      </span>
    </div>
  );
}

function loadHistory(): NdviResult[] {
  try {
    const value = window.localStorage.getItem(HISTORY_KEY);
    if (!value) return [];
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as NdviResult[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(history: NdviResult[]) {
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
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
