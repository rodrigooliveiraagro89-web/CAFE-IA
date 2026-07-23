import {
  Camera,
  CheckCircle2,
  FileText,
  FlaskConical,
  LoaderCircle,
  Pencil,
  Save,
  TriangleAlert,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { AppView } from "../../app/navigation";
import type { AgriculturalController } from "../../lib/useAgriculturalContext";
import {
  interpretSoil,
  soilAlerts,
  soilLevelLabel,
  SOIL_REFERENCES,
  type SoilValues,
} from "../../domain/soilAnalysis";
import { extractSoilFromFile } from "./soilClient";
import { useSoilAnalyses, type SoilAnalysis, type SoilSource } from "./soilStore";
import "./soil.css";

type SoilModuleProps = {
  agriculture: AgriculturalController;
  accessToken: string;
  soil: ReturnType<typeof useSoilAnalyses>;
  onNavigate: (view: AppView) => void;
};

type DraftState = {
  values: SoilValues;
  analysisDate: string;
  laboratory: string;
  source: SoilSource;
};

const emptyDraft: DraftState = {
  values: {},
  analysisDate: "",
  laboratory: "",
  source: "manual",
};

type UploadState =
  | { status: "idle" }
  | { status: "reading"; message: string }
  | { status: "error"; message: string };

export function SoilModule({ agriculture, accessToken, soil, onNavigate }: SoilModuleProps) {
  const plot = agriculture.selectedPlot;
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>({ status: "idle" });
  const [saved, setSaved] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  const interpretation = useMemo(
    () => (draft ? interpretSoil(draft.values) : []),
    [draft],
  );
  const alerts = useMemo(() => soilAlerts(interpretation), [interpretation]);
  const levelByKey = useMemo(
    () => new Map(interpretation.map((row) => [row.key, row.level])),
    [interpretation],
  );
  const plotAnalyses = soil.analyses.filter((item) => item.plotId === plot?.id);

  async function handleFile(file: File | undefined, source: SoilSource) {
    if (!file) return;
    setSaved(false);
    setUploadState({ status: "reading", message: "Lendo o laudo com IA…" });
    try {
      const extraction = await extractSoilFromFile(file, accessToken);
      setDraft({
        values: extraction.values,
        analysisDate: extraction.analysisDate ?? "",
        laboratory: extraction.laboratory ?? "",
        source,
      });
      setUploadState({ status: "idle" });
    } catch (error) {
      setUploadState({
        status: "error",
        message: error instanceof Error ? error.message : "Não foi possível ler o laudo.",
      });
    }
  }

  function startManual() {
    setSaved(false);
    setUploadState({ status: "idle" });
    setDraft({ ...emptyDraft });
  }

  function updateValue(key: keyof SoilValues, raw: string) {
    setDraft((current) => {
      if (!current) return current;
      const parsed = raw.trim() === "" ? null : Number(raw.replace(",", "."));
      return {
        ...current,
        values: { ...current.values, [key]: Number.isFinite(parsed) ? parsed : null },
      };
    });
  }

  function save() {
    if (!draft || !plot) return;
    soil.addAnalysis({
      plotId: plot.id,
      analysisDate: draft.analysisDate || null,
      laboratory: draft.laboratory || null,
      source: draft.source,
      values: draft.values,
    });
    setSaved(true);
    setDraft(null);
    setUploadState({ status: "idle" });
  }

  if (!plot) {
    return (
      <div className="page-stack platform-page">
        <header className="page-header">
          <span className="eyebrow">Fertilidade</span>
          <h1>Análise de solo</h1>
        </header>
        <section className="empty-state context-empty">
          <FlaskConical size={31} />
          <h2>Selecione um talhão</h2>
          <p>A análise de solo é vinculada à área correta para preservar o histórico.</p>
          <button type="button" onClick={() => onNavigate("propriedades")}>
            Abrir propriedades e talhões
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack platform-page">
      <header className="page-header context-page-header">
        <div>
          <span className="eyebrow">
            {agriculture.selectedProperty?.name} · {plot.name}
          </span>
          <h1>Análise de solo</h1>
          <p>Envie a foto ou o PDF do laudo — a IA extrai os valores e o AGRYN interpreta.</p>
        </div>
      </header>

      {!draft && (
        <section className="soil-source-grid">
          <button className="soil-source-card" type="button" onClick={() => photoRef.current?.click()}>
            <Camera size={26} />
            <strong>Foto do laudo</strong>
            <small>Tire uma foto nítida do laudo em papel.</small>
          </button>
          <button className="soil-source-card" type="button" onClick={() => pdfRef.current?.click()}>
            <FileText size={26} />
            <strong>PDF do laboratório</strong>
            <small>Envie o relatório digital em PDF.</small>
          </button>
          <button className="soil-source-card" type="button" onClick={startManual}>
            <Pencil size={26} />
            <strong>Digitar valores</strong>
            <small>Preencha os campos manualmente.</small>
          </button>
          <input
            ref={photoRef}
            type="file"
            hidden
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={(event) => void handleFile(event.target.files?.[0], "foto")}
          />
          <input
            ref={pdfRef}
            type="file"
            hidden
            accept="application/pdf"
            onChange={(event) => void handleFile(event.target.files?.[0], "pdf")}
          />
        </section>
      )}

      {uploadState.status === "reading" && (
        <div className="soil-status" role="status">
          <LoaderCircle size={18} className="spin" /> <span>{uploadState.message}</span>
        </div>
      )}
      {uploadState.status === "error" && (
        <div className="soil-status" data-error="true" role="alert">
          <TriangleAlert size={18} /> <span>{uploadState.message}</span>
        </div>
      )}
      {saved && (
        <div className="soil-status" data-success="true" role="status">
          <CheckCircle2 size={18} /> <span>Análise salva no talhão.</span>
        </div>
      )}

      {draft && (
        <section className="panel-card">
          <div className="panel-title">
            <FlaskConical size={21} />
            <div>
              <span className="eyebrow">
                {draft.source === "manual" ? "Digitação manual" : "Confira os valores extraídos"}
              </span>
              <h2>Valores do laudo</h2>
            </div>
          </div>
          <p className="soil-review-note">
            Revise e ajuste qualquer valor antes de salvar — a leitura por IA pode errar, e a
            interpretação é orientativa (não substitui o laudo com textura e o parecer do
            responsável técnico).
          </p>

          <div className="form-grid">
            <label>
              Data da análise
              <input
                type="date"
                value={draft.analysisDate}
                onChange={(event) =>
                  setDraft((current) => (current ? { ...current, analysisDate: event.target.value } : current))
                }
              />
            </label>
            <label>
              Laboratório
              <input
                value={draft.laboratory}
                onChange={(event) =>
                  setDraft((current) => (current ? { ...current, laboratory: event.target.value } : current))
                }
              />
            </label>
          </div>

          <div className="soil-values-grid">
            {SOIL_REFERENCES.map((reference) => {
              const value = draft.values[reference.key];
              const level = levelByKey.get(reference.key);
              return (
                <label key={reference.key} className="soil-value-field">
                  <span className="soil-value-label">
                    {reference.label}
                    {reference.unit && <em> ({reference.unit})</em>}
                  </span>
                  <div className="soil-value-input">
                    <input
                      inputMode="decimal"
                      value={value ?? ""}
                      onChange={(event) => updateValue(reference.key, event.target.value)}
                      data-empty={value === null || value === undefined}
                    />
                    {level && level !== "informativo" && (
                      <span className={`soil-level soil-level-${level}`}>{soilLevelLabel(level)}</span>
                    )}
                  </div>
                </label>
              );
            })}
          </div>

          {alerts.length > 0 && (
            <div className="soil-alerts">
              <strong>Pontos de atenção</strong>
              <ul>
                {alerts.map((alert) => (
                  <li key={alert}>{alert}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="form-actions">
            <button className="secondary-button" type="button" onClick={() => setDraft(null)}>
              Cancelar
            </button>
            <button className="primary-button" type="button" onClick={save}>
              <Save size={16} /> Salvar análise
            </button>
          </div>
        </section>
      )}

      {plotAnalyses.length > 0 && (
        <section aria-labelledby="soil-history-title">
          <div className="section-heading compact-heading">
            <div>
              <span className="eyebrow">Histórico</span>
              <h2 id="soil-history-title">Laudos deste talhão</h2>
            </div>
          </div>
          <div className="soil-history-list">
            {plotAnalyses.map((analysis) => (
              <SoilHistoryCard key={analysis.id} analysis={analysis} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SoilHistoryCard({ analysis }: { analysis: SoilAnalysis }) {
  const rows = interpretSoil(analysis.values);
  const alerts = soilAlerts(rows);
  const date = analysis.analysisDate
    ? new Date(`${analysis.analysisDate}T12:00:00`).toLocaleDateString("pt-BR")
    : new Date(analysis.createdAt).toLocaleDateString("pt-BR");
  return (
    <article className="soil-history-card">
      <div className="soil-history-head">
        <strong>{date}</strong>
        <small>
          {analysis.laboratory || "Laboratório não informado"} ·{" "}
          {analysis.source === "manual" ? "digitado" : analysis.source === "pdf" ? "PDF" : "foto"}
        </small>
      </div>
      <div className="soil-history-values">
        {rows.slice(0, 6).map((row) => (
          <span key={row.key}>
            {row.label.split(" ")[0]}: <strong>{row.value.toLocaleString("pt-BR")}</strong>
          </span>
        ))}
      </div>
      {alerts.length > 0 && <p className="soil-history-alert">{alerts.length} ponto(s) de atenção</p>}
    </article>
  );
}
