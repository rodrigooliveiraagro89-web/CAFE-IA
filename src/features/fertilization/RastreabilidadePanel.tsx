import { Fingerprint, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { hashSnapshot, shortHash, type RecommendationSnapshot } from "../../domain/recommendationSnapshot";

type Props = {
  snapshot: RecommendationSnapshot;
  laudoLabel: string;
};

/**
 * Proveniência da recomendação em tempo real + impressão digital (SHA-256) do
 * conteúdo atual. Mostra de onde a dose nasceu (laudo, base 5ª versionada,
 * catálogo, parâmetros) e o hash que identifica exatamente esta recomendação.
 * Ao salvar (botão do painel), este mesmo conteúdo é congelado de forma imutável
 * em recommendation_snapshots — depois qualquer um recomputa o hash e confere.
 */
export function RastreabilidadePanel({ snapshot, laudoLabel }: Props) {
  // Guardamos a QUAL snapshot o hash pertence: assim, quando o snapshot muda, o
  // hash antigo deixa de ser exibido (mostra "…") até o novo SHA-256 resolver —
  // sem setState síncrono dentro do effect.
  const [hashState, setHashState] = useState<{ snap: RecommendationSnapshot; hash: string } | null>(null);

  useEffect(() => {
    let active = true;
    void hashSnapshot(snapshot).then((h) => {
      if (active) setHashState({ snap: snapshot, hash: h });
    });
    return () => {
      active = false;
    };
  }, [snapshot]);

  const hash = hashState && hashState.snap === snapshot ? hashState.hash : "";

  return (
    <section className="panel-card rastreio">
      <div className="panel-title">
        <ShieldCheck size={21} />
        <div><span className="eyebrow">Proveniência e prova</span><h2>Rastreabilidade da recomendação</h2></div>
      </div>

      <dl className="rastreio-prov">
        <div><dt>Base técnica</dt><dd>{snapshot.engine} · versão {snapshot.version}</dd></div>
        <div><dt>Catálogo de fórmulas</dt><dd>{snapshot.params.catalogo ?? "—"}</dd></div>
        <div><dt>Laudo de origem</dt><dd>{laudoLabel}</dd></div>
        <div><dt>Parâmetros</dt><dd>V% alvo {snapshot.params.vAlvo} · {snapshot.params.sacas} sc/ha · fase {snapshot.params.fase ?? "—"}</dd></div>
        <div><dt>Dose (kg/ha·ano)</dt><dd>N {Math.round(snapshot.npk.n)} · P₂O₅ {Math.round(snapshot.npk.p2o5)} · K₂O {Math.round(snapshot.npk.k2o)} · S {Math.round(snapshot.npk.s)}</dd></div>
      </dl>

      <div className="rastreio-hash-line" title={hash}>
        <Fingerprint size={15} />
        <span>Impressão digital (SHA-256):</span>
        <code>{hash ? shortHash(hash) : "…"}</code>
      </div>
      <p className="rastreio-nota">Ao salvar a recomendação, esta impressão digital fica registrada de forma imutável — a prova de qual dose saiu, de qual laudo e em que data.</p>
    </section>
  );
}
