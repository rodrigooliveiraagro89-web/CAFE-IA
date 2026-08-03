import { useRef, useState } from "react";
import { ArrowRight, Camera, Info, Leaf, RefreshCw, Upload } from "lucide-react";
import type { AppView } from "../../app/navigation";
import { WakeHint } from "../../components/ui/WakeHint";
import { diagnoseImage, type Confianca, type Diagnosis } from "./visionClient";
import "./diagnosis.css";

type DiagnosisModuleProps = {
  accessToken: string;
  onNavigate: (view: AppView) => void;
};

const CONFIANCA_LABEL: Record<Confianca, string> = {
  alta: "Confiança alta",
  media: "Confiança média",
  baixa: "Confiança baixa",
};

export function DiagnosisModule({ accessToken, onNavigate }: DiagnosisModuleProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function analisar(file: File | undefined) {
    if (!file) return;
    if (!accessToken) {
      setErro("Faça login para usar o diagnóstico por foto.");
      return;
    }
    setErro(null);
    setDiagnosis(null);
    setPreview(URL.createObjectURL(file));
    setLoading(true);
    try {
      setDiagnosis(await diagnoseImage(file, accessToken));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível analisar a foto.");
    } finally {
      setLoading(false);
    }
  }

  function limpar() {
    setPreview(null);
    setDiagnosis(null);
    setErro(null);
  }

  return (
    <div className="page-stack platform-page">
      <header className="page-header context-page-header">
        <div>
          <span className="eyebrow">Inteligência artificial · visão</span>
          <h1>Diagnóstico por foto</h1>
          <p>
            Tire uma foto do sintoma e a IA sugere o diagnóstico mais provável. É uma triagem —
            a confirmação é do agrônomo em campo.
          </p>
        </div>
        <button className="secondary-button" type="button" onClick={() => onNavigate("assistente")}>
          Falar com a IA <ArrowRight size={17} />
        </button>
      </header>

      <p className="assistant-governance">
        <Info size={16} aria-hidden="true" />
        <span>
          O diagnóstico é <strong>provável</strong>, nunca definitivo, e <strong>não indica
          produto nem dose</strong>. Use para orientar a inspeção e a decisão do responsável
          técnico.
        </span>
      </p>

      <input
        ref={cameraRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        hidden
        onChange={(event) => void analisar(event.target.files?.[0])}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(event) => void analisar(event.target.files?.[0])}
      />

      {!preview ? (
        <section className="diag-picker">
          <button type="button" onClick={() => cameraRef.current?.click()}>
            <Camera size={26} />
            <strong>Tirar foto</strong>
            <small>Usa a câmera do celular</small>
          </button>
          <button type="button" onClick={() => fileRef.current?.click()}>
            <Upload size={26} />
            <strong>Enviar imagem</strong>
            <small>Escolher da galeria</small>
          </button>
        </section>
      ) : (
        <section className="panel-card diag-result">
          <div className="diag-media">
            <img src={preview} alt="Foto enviada para diagnóstico" />
            <button type="button" className="secondary-button" onClick={limpar}>
              <RefreshCw size={16} /> Nova foto
            </button>
          </div>

          {loading && <p className="diag-loading"><Leaf size={17} /> Analisando a foto…</p>}
          <WakeHint active={loading} />
          {erro && <p className="assistant-error">{erro}</p>}

          {diagnosis && (
            <div className="diag-report">
              <div className="diag-head">
                <h2>{diagnosis.provavel}</h2>
                <span className="diag-confianca" data-nivel={diagnosis.confianca}>
                  {CONFIANCA_LABEL[diagnosis.confianca]}
                </span>
              </div>

              {diagnosis.sinaisObservados.length > 0 && (
                <div className="diag-block">
                  <h3>Sinais observados</h3>
                  <ul>{diagnosis.sinaisObservados.map((s) => <li key={s}>{s}</li>)}</ul>
                </div>
              )}
              {diagnosis.possiveisCausas.length > 0 && (
                <div className="diag-block">
                  <h3>Possíveis causas</h3>
                  <ul>{diagnosis.possiveisCausas.map((s) => <li key={s}>{s}</li>)}</ul>
                </div>
              )}
              {diagnosis.manejoGeral.length > 0 && (
                <div className="diag-block">
                  <h3>Manejo geral</h3>
                  <ul>{diagnosis.manejoGeral.map((s) => <li key={s}>{s}</li>)}</ul>
                </div>
              )}
              {diagnosis.recomendaConfirmar && (
                <div className="diag-confirm">
                  <strong>Para confirmar:</strong> {diagnosis.recomendaConfirmar}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <p className="fert-disclaimer">
        A triagem por imagem pode errar, especialmente em fotos de baixa qualidade. Confirme em
        campo e trate apenas sob recomendação do engenheiro agrônomo responsável, respeitando o
        registro do produto para a cultura e o período de carência.
      </p>
    </div>
  );
}
