import { CalendarCheck, CheckCircle2, ClipboardList, Plus, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import type { AppView } from "../../app/navigation";
import {
  activityTypes,
  type FieldRecord,
  type FieldRecordInput,
} from "../../domain/fieldRecords";
import type { AgriculturalController } from "../../lib/useAgriculturalContext";

type FieldNotebookProps = {
  agriculture: AgriculturalController;
  records: FieldRecord[];
  onAdd: (propertyId: string, plotId: string, input: FieldRecordInput) => void;
  onToggle: (recordId: string) => void;
  onRemove: (recordId: string) => void;
  onNavigate: (view: AppView) => void;
};

function blankRecord(): FieldRecordInput {
  return {
    type: "Inspeção",
    title: "",
    date: new Date().toISOString().slice(0, 10),
    notes: "",
    status: "planejada",
    cost: 0,
    quantity: "",
    unit: "",
  };
}

export function FieldNotebook({
  agriculture,
  records,
  onAdd,
  onToggle,
  onRemove,
  onNavigate,
}: FieldNotebookProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState(blankRecord);
  const [filter, setFilter] = useState<"todas" | "planejada" | "concluida">("todas");
  const contextualRecords = useMemo(
    () =>
      records
        .filter((record) => record.plotId === agriculture.selectedPlot?.id)
        .filter((record) => filter === "todas" || record.status === filter),
    [agriculture.selectedPlot?.id, filter, records],
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!agriculture.selectedProperty || !agriculture.selectedPlot) return;
    onAdd(agriculture.selectedProperty.id, agriculture.selectedPlot.id, draft);
    setDraft(blankRecord());
    setFormOpen(false);
  }

  if (!agriculture.selectedPlot) {
    return (
      <div className="page-stack platform-page">
        <header className="page-header"><span className="eyebrow">Rastreabilidade</span><h1>Caderno de campo</h1></header>
        <section className="empty-state context-empty">
          <ClipboardList size={31} />
          <h2>Selecione um talhão</h2>
          <p>As atividades são vinculadas à área correta para preservar o histórico da safra.</p>
          <button type="button" onClick={() => onNavigate("propriedades")}>Abrir propriedades e talhões</button>
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack platform-page">
      <header className="page-header context-page-header">
        <div>
          <span className="eyebrow">{agriculture.selectedProperty?.name} · {agriculture.selectedPlot.name}</span>
          <h1>Caderno de campo</h1>
          <p>Registre ações, observações, documentos e custos no histórico real do talhão.</p>
        </div>
        <button className="primary-button" type="button" onClick={() => setFormOpen(true)}><Plus size={18} /> Nova atividade</button>
      </header>

      {formOpen && (
        <form className="data-form panel-card" onSubmit={submit}>
          <div className="form-grid">
            <label>Tipo<select value={draft.type} onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value }))}>{activityTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
            <label>Título<input required value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} /></label>
            <label>Data<input required type="date" value={draft.date} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} /></label>
            <label>Status<select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as FieldRecordInput["status"] }))}><option value="planejada">Planejada</option><option value="concluida">Concluída</option></select></label>
            <label>Custo total (R$)<input min="0" step="0.01" type="number" value={draft.cost || ""} onChange={(event) => setDraft((current) => ({ ...current, cost: Number(event.target.value) }))} /></label>
            <label>Quantidade<input value={draft.quantity} onChange={(event) => setDraft((current) => ({ ...current, quantity: event.target.value }))} /></label>
            <label>Unidade<input value={draft.unit} onChange={(event) => setDraft((current) => ({ ...current, unit: event.target.value }))} placeholder="kg, L, h, sacas..." /></label>
            <label className="wide-field">Observações<textarea rows={3} value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} /></label>
          </div>
          <div className="form-actions"><button className="secondary-button" type="button" onClick={() => setFormOpen(false)}>Cancelar</button><button className="primary-button" type="submit">Salvar atividade</button></div>
        </form>
      )}

      <div className="record-toolbar">
        <div><strong>{contextualRecords.length}</strong><span> registros exibidos</span></div>
        <div className="segmented-control">
          {(["todas", "planejada", "concluida"] as const).map((item) => <button key={item} data-active={filter === item} onClick={() => setFilter(item)} type="button">{item === "todas" ? "Todas" : item === "planejada" ? "Planejadas" : "Concluídas"}</button>)}
        </div>
      </div>

      {contextualRecords.length === 0 ? (
        <section className="empty-state context-empty"><CalendarCheck size={31} /><h2>Nenhuma atividade neste filtro</h2><p>O histórico começa quando você registra a primeira ocorrência real.</p></section>
      ) : (
        <section className="record-list" aria-label="Atividades do talhão">
          {contextualRecords.map((record) => (
            <article className="record-card" data-completed={record.status === "concluida"} key={record.id}>
              <button className="record-status" type="button" onClick={() => onToggle(record.id)} aria-label={record.status === "concluida" ? "Reabrir atividade" : "Concluir atividade"}><CheckCircle2 size={22} /></button>
              <div className="record-main"><div><span className="record-type">{record.type}</span><strong>{record.title}</strong></div><small>{new Date(`${record.date}T12:00:00`).toLocaleDateString("pt-BR")}{record.quantity ? ` · ${record.quantity} ${record.unit}` : ""}</small>{record.notes && <p>{record.notes}</p>}</div>
              {record.cost > 0 && <strong className="record-cost">{record.cost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong>}
              <button className="danger-icon" type="button" title="Excluir atividade" onClick={() => { if (window.confirm(`Excluir a atividade ${record.title}?`)) onRemove(record.id); }}><Trash2 size={17} /></button>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
