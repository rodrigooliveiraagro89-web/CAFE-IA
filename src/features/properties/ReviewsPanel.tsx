import { ClipboardCheck, Send, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import {
  canReviewProperty,
  createReview,
  deleteReview,
  listReviews,
  type TechnicalReview,
} from "./reviewsClient";

/**
 * Pareceres técnicos da propriedade (§22). O consultor (colaborador 'agronomist')
 * ou o dono registra um parecer; todos que enxergam a propriedade leem. A RLS
 * corrigida garante o escopo por propriedade, autoria server-side (trigger) e
 * append-only (não se edita). O formulário só aparece para quem pode escrever.
 */
export function ReviewsPanel({ propertyId, propertyName, userId }: { propertyId: string; propertyName: string; userId?: string | null }) {
  const [reviews, setReviews] = useState<TechnicalReview[]>([]);
  const [podeEscrever, setPodeEscrever] = useState(false);
  const [texto, setTexto] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [loadErro, setLoadErro] = useState(false);

  useEffect(() => {
    let active = true;
    listReviews(propertyId)
      .then((list) => { if (active) { setReviews(list); setLoadErro(false); } })
      .catch(() => { if (active) setLoadErro(true); });
    void canReviewProperty(propertyId).then((ok) => { if (active) setPodeEscrever(ok); });
    return () => {
      active = false;
    };
  }, [propertyId]);

  async function registrar(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErro("");
    const res = await createReview(propertyId, texto);
    if (res.ok) {
      setReviews((prev) => [res.review, ...prev]);
      setTexto("");
    } else {
      setErro(res.reason);
    }
    setBusy(false);
  }

  async function remover(id: string) {
    if (await deleteReview(id)) setReviews((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <section className="panel-card reviews-panel">
      <div className="section-heading compact-heading">
        <div>
          <span className="eyebrow"><ClipboardCheck size={13} /> Pareceres técnicos</span>
          <h2>Acompanhamento de {propertyName}</h2>
          <p>Parecer registrado pelo consultor. Fica no histórico da propriedade, visível para o produtor e a equipe.</p>
        </div>
      </div>

      {podeEscrever ? (
        <form className="reviews-form" onSubmit={(event) => void registrar(event)}>
          <textarea
            rows={3}
            value={texto}
            onChange={(event) => setTexto(event.target.value)}
            placeholder="Ex.: Visita 28/08 — florada uniforme. Antecipar a 1ª parcela de cobertura; monitorar bicho-mineiro no talhão baixo."
            aria-label="Novo parecer técnico"
          />
          <button className="primary-button" type="submit" disabled={busy || !texto.trim()}>
            <Send size={16} /> {busy ? "Registrando…" : "Registrar parecer"}
          </button>
        </form>
      ) : (
        <p className="share-note">Só o produtor ou um consultor técnico com acesso registra pareceres. Você acompanha os registros abaixo.</p>
      )}
      {erro && <p className="share-erro">{erro}</p>}

      {loadErro ? (
        <p className="share-erro">Não foi possível carregar os pareceres. Tente de novo.</p>
      ) : reviews.length === 0 ? (
        <p className="share-note">Nenhum parecer ainda.</p>
      ) : (
        <ul className="reviews-list">
          {reviews.map((r) => (
            <li key={r.id}>
              <div className="reviews-meta">
                <strong>{r.reviewerName}</strong>
                <span>{r.createdAt ? new Date(r.createdAt).toLocaleDateString("pt-BR") : ""}</span>
                {userId && r.reviewerId === userId && (
                  <button type="button" className="ghost-icon" aria-label="Apagar parecer" title="Apagar parecer" onClick={() => void remover(r.id)}>
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
              <p>{r.notes}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
