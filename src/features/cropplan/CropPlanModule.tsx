import {
  CalendarRange,
  CheckCircle2,
  Circle,
  CircleDollarSign,
  ClipboardList,
  Plus,
  RotateCcw,
  Sparkles,
  Target,
  Trash2,
  XCircle,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import type { AppView } from "../../app/navigation";
import { COFFEE_CALENDAR, monthLabel } from "../../domain/coffeeCalendar";
import {
  cronogramaAdubacao,
  recomendarNutrientes5a,
} from "../../domain/coffeeFertility5a";
import {
  KIND_LABEL,
  findPlanForPlot,
  generatePlanItems,
  safraLabel,
  sortPlanItems,
  summarizePlan,
  type CropPlanItem,
} from "../../domain/cropPlan";
import { CENARIOS, type CenarioId } from "../../domain/fertilization";
import type { FieldRecordInput } from "../../domain/fieldRecords";
import { analysisToSolo, subFromValues } from "../fertilization/soilToSolo";
import type { SoilAnalysis } from "../soil/soilStore";
import type { AgriculturalController } from "../../lib/useAgriculturalContext";
import type { CropPlanController } from "./useCropPlan";
import "./cropplan.css";

type CropPlanModuleProps = {
  agriculture: AgriculturalController;
  cropPlan: CropPlanController;
  soilAnalyses: SoilAnalysis[];
  records: { id: string; plotId: string; cost: number }[];
  onRegistrarAplicacao: (
    propertyId: string,
    plotId: string,
    input: FieldRecordInput,
  ) => Promise<string | void>;
  onRemoverAplicacao: (recordId: string) => void;
  onNavigate: (view: AppView) => void;
};

const KIND_OPTIONS = ["adubacao", "analise", "foliar", "calagem", "poda", "manejo", "plantio", "desbrota", "colheita", "outro"];

function loadCenario(plotId: string): CenarioId {
  try {
    const raw = localStorage.getItem(`agryn.fert5a.${plotId}`);
    if (raw === "baixa" || raw === "media" || raw === "alta") return raw;
  } catch {
    // sem persistência
  }
  return "media";
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function blankManual(): Pick<CropPlanItem, "kind" | "title" | "month" | "plannedCost" | "quantity" | "unit"> {
  return { kind: "manejo", title: "", month: new Date().getMonth() + 1, plannedCost: 0, quantity: "", unit: "" };
}

export function CropPlanModule({
  agriculture,
  cropPlan,
  soilAnalyses,
  records,
  onRegistrarAplicacao,
  onRemoverAplicacao,
  onNavigate,
}: CropPlanModuleProps) {
  const plot = agriculture.selectedPlot;
  const property = agriculture.selectedProperty;
  const [costDraft, setCostDraft] = useState<Record<string, string>>({});
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState(blankManual);

  // Um plano por (talhão × safra): a busca inclui a safra atual do talhão, senão
  // ao virar a safra (plot.season) o produtor ficaria preso no plano anterior,
  // sem como gerar o novo (o card de gerar só aparece com !plan).
  const plan = useMemo(
    () => (plot ? findPlanForPlot(cropPlan.plans, plot.id, plot.season) : null),
    [cropPlan.plans, plot],
  );
  const plotRecords = useMemo(
    () => (plot ? records.filter((r) => r.plotId === plot.id) : []),
    [records, plot],
  );
  const summary = plan ? summarizePlan(plan, plotRecords) : null;
  const itensOrdenados = plan ? sortPlanItems(plan.items) : [];

  if (!plot || !property) {
    return (
      <div className="page-stack platform-page">
        <header className="page-header"><span className="eyebrow">Manejo planejado</span><h1>Plano de safra</h1></header>
        <section className="empty-state context-empty">
          <ClipboardList size={31} />
          <h2>Selecione um talhão</h2>
          <p>O plano de safra organiza as operações do ciclo por área, com custo previsto e acompanhamento.</p>
          <button type="button" onClick={() => onNavigate("propriedades")}>Abrir propriedades e talhões</button>
        </section>
      </div>
    );
  }

  const gerarItens = (): CropPlanItem[] => {
    const solo = soilAnalyses
      .filter((s) => s.plotId === plot.id)
      .sort((a, b) => new Date(b.analysisDate ?? b.createdAt).getTime() - new Date(a.analysisDate ?? a.createdAt).getTime())[0];
    let cronograma;
    if (solo) {
      const sacas = CENARIOS.find((c) => c.id === loadCenario(plot.id))?.sacasPorHectare ?? 45;
      const rec = recomendarNutrientes5a({
        lavoura: { fase: "producao", produtividade_esperada_sc_ha: sacas, PRNT_percentual: 95 },
        solo: analysisToSolo(solo.values),
        sub: subFromValues(solo.values),
      });
      cronograma = cronogramaAdubacao(rec.necessidade_nutrientes, rec.doses_por_planta?.N_aplicacoes ?? 4);
    }
    return generatePlanItems({ calendar: COFFEE_CALENDAR, cronograma, idFactory: () => crypto.randomUUID() });
  };

  const criarPlano = (items: CropPlanItem[]) => {
    cropPlan.addPlan({
      propertyId: property.id,
      plotId: plot.id,
      safra: safraLabel(plot.season),
      title: `Plano de safra — ${plot.name}`,
      items,
    });
  };

  // Delega ao controller, que reconcilia sobre o estado current (evita lost
  // update entre conclusões concorrentes).
  const patchItem = (itemId: string, patch: Partial<CropPlanItem>) => {
    if (!plan) return;
    cropPlan.patchItem(plan.id, itemId, patch);
  };

  const removeItem = (itemId: string) => {
    if (!plan) return;
    cropPlan.removeItem(plan.id, itemId);
  };

  function reabrirItem(item: CropPlanItem) {
    // Reabrir apaga o registro que a conclusão criou no caderno, senão concluir
    // de novo geraria um segundo registro (duplicidade no Centro de Custos), e
    // limpa o vínculo/realizado do item.
    if (item.fieldRecordId) onRemoverAplicacao(item.fieldRecordId);
    patchItem(item.id, { status: "planejada", fieldRecordId: undefined, realizedCost: undefined });
  }

  async function concluirItem(item: CropPlanItem) {
    if (!plan || !property || !plot) return;
    const input: FieldRecordInput = {
      type: KIND_LABEL[item.kind] ?? "Manejo",
      title: item.title,
      date: new Date().toISOString().slice(0, 10),
      notes: item.notes,
      status: "concluida",
      cost: item.plannedCost > 0 ? item.plannedCost : 0,
      quantity: item.quantity,
      unit: item.unit,
    };
    const recordId = await onRegistrarAplicacao(property.id, plot.id, input);
    patchItem(item.id, {
      status: "concluida",
      fieldRecordId: typeof recordId === "string" ? recordId : undefined,
      realizedCost: item.plannedCost > 0 ? item.plannedCost : 0,
    });
  }

  function adicionarManual(event: FormEvent) {
    event.preventDefault();
    if (!manual.title.trim()) return;
    const novo: CropPlanItem = {
      id: crypto.randomUUID(),
      kind: manual.kind,
      title: manual.title.trim(),
      month: manual.month,
      plannedCost: manual.plannedCost || 0,
      quantity: manual.quantity,
      unit: manual.unit,
      status: "planejada",
      notes: "",
      source: "manual",
    };
    if (plan) cropPlan.addItem(plan.id, novo);
    else criarPlano([novo]);
    setManual(blankManual());
    setManualOpen(false);
  }

  return (
    <div className="page-stack platform-page cropplan-page">
      <header className="page-header context-page-header">
        <div>
          <span className="eyebrow">{property.name} · {plot.name}</span>
          <h1>Plano de safra</h1>
          <p>As operações do ciclo com custo previsto. Ao concluir uma, ela vira registro no caderno — o realizado.</p>
        </div>
        <button className="secondary-button" type="button" onClick={() => onNavigate("custos")}>Ver custos <CircleDollarSign size={17} /></button>
      </header>

      {!plan ? (
        <section className="panel-card cropplan-generate">
          <div className="panel-title"><Sparkles size={21} /><div><span className="eyebrow">{safraLabel(plot.season)}</span><h2>Monte o plano do talhão</h2></div></div>
          <p>Geramos as operações a partir do calendário do cafeicultor e, se houver laudo, das parcelas de adubação da 5ª Aproximação. Depois você ajusta custos e datas.</p>
          <div className="form-actions">
            <button className="primary-button" type="button" onClick={() => criarPlano(gerarItens())}><Sparkles size={18} /> Gerar plano da safra</button>
            <button className="secondary-button" type="button" onClick={() => criarPlano([])}>Começar em branco</button>
          </div>
        </section>
      ) : (
        <>
          <section className="cropplan-summary" aria-label="Previsto e realizado">
            <article><span><Target size={19} /> Previsto</span><strong>{summary && summary.plannedTotal > 0 ? brl(summary.plannedTotal) : "—"}</strong><small>{summary?.activeCount ?? 0} operações no plano</small></article>
            <article><span><CircleDollarSign size={19} /> Realizado</span><strong>{summary && summary.realizedTotal > 0 ? brl(summary.realizedTotal) : "—"}</strong><small>{summary?.doneCount ?? 0} concluídas</small></article>
            <article><span><CheckCircle2 size={19} /> Aderência</span><strong>{summary?.adherencePct ?? 0}%</strong><div className="cropplan-progress"><i style={{ width: `${summary?.adherencePct ?? 0}%` }} /></div></article>
          </section>

          <div className="record-toolbar">
            <div><strong>{itensOrdenados.length}</strong><span> operações no plano</span></div>
            <div className="cropplan-toolbar-actions">
              <button className="secondary-button" type="button" onClick={() => setManualOpen((v) => !v)}><Plus size={16} /> Operação manual</button>
              <button className="ghost-icon" type="button" aria-label="Excluir plano da safra" title="Excluir plano da safra" onClick={() => { if (window.confirm(`Excluir o plano da safra ${plan.safra}?`)) cropPlan.removePlan(plan.id); }}><Trash2 size={16} /></button>
            </div>
          </div>

          {manualOpen && (
            <form className="data-form panel-card" onSubmit={adicionarManual}>
              <div className="form-grid">
                <label>Categoria<select value={manual.kind} onChange={(e) => setManual((m) => ({ ...m, kind: e.target.value }))}>{KIND_OPTIONS.map((k) => <option key={k} value={k}>{KIND_LABEL[k] ?? k}</option>)}</select></label>
                <label>Operação<input required value={manual.title} onChange={(e) => setManual((m) => ({ ...m, title: e.target.value }))} placeholder="Ex.: Pulverização preventiva" /></label>
                <label>Mês<select value={manual.month} onChange={(e) => setManual((m) => ({ ...m, month: Number(e.target.value) }))}>{Array.from({ length: 12 }, (_, i) => i + 1).map((mth) => <option key={mth} value={mth}>{monthLabel(mth)}</option>)}</select></label>
                <label>Custo previsto (R$)<input min="0" step="1" type="number" inputMode="decimal" value={manual.plannedCost || ""} onChange={(e) => setManual((m) => ({ ...m, plannedCost: Number(e.target.value) }))} /></label>
                <label>Quantidade<input value={manual.quantity} onChange={(e) => setManual((m) => ({ ...m, quantity: e.target.value }))} placeholder="opcional" /></label>
                <label>Unidade<input value={manual.unit} onChange={(e) => setManual((m) => ({ ...m, unit: e.target.value }))} placeholder="kg/ha, L…" /></label>
              </div>
              <div className="form-actions"><button className="secondary-button" type="button" onClick={() => setManualOpen(false)}>Cancelar</button><button className="primary-button" type="submit">Adicionar ao plano</button></div>
            </form>
          )}

          <section className="cropplan-list" aria-label="Operações do plano">
            {itensOrdenados.map((item) => {
              const draftValue = costDraft[item.id] ?? (item.plannedCost > 0 ? String(item.plannedCost) : "");
              return (
                <article className="cropplan-item" data-status={item.status} key={item.id}>
                  <span className="cropplan-month"><CalendarRange size={14} /> {monthLabel(item.month)}</span>
                  <div className="cropplan-body">
                    <div className="cropplan-item-head">
                      <span className="cropplan-kind" data-kind={item.kind}>{KIND_LABEL[item.kind] ?? item.kind}</span>
                      <strong>{item.title}</strong>
                    </div>
                    {item.quantity && <small>{item.quantity}{item.unit ? ` ${item.unit}` : ""}</small>}
                    {item.notes && <p>{item.notes}</p>}
                  </div>
                  <label className="cropplan-cost" title="Custo previsto">
                    <span>R$ previsto</span>
                    <input
                      inputMode="decimal"
                      type="number"
                      min="0"
                      step="1"
                      value={draftValue}
                      disabled={item.status !== "planejada"}
                      onChange={(e) => setCostDraft((d) => ({ ...d, [item.id]: e.target.value }))}
                      onBlur={() => {
                        if (costDraft[item.id] === undefined) return;
                        patchItem(item.id, { plannedCost: Number(costDraft[item.id]) || 0 });
                        setCostDraft((d) => {
                          const next = { ...d };
                          delete next[item.id];
                          return next;
                        });
                      }}
                    />
                  </label>
                  <div className="cropplan-actions">
                    {item.status === "planejada" && (
                      <button type="button" className="primary-button cropplan-done" onClick={() => void concluirItem(item)} title="Concluir e registrar no caderno"><CheckCircle2 size={16} /> Concluir</button>
                    )}
                    {item.status === "concluida" && (
                      <button type="button" className="ghost-icon" aria-label="Reabrir operação" onClick={() => reabrirItem(item)} title="Reabrir operação"><RotateCcw size={16} /></button>
                    )}
                    {/* Cancelar só em planejada: um item concluído precisa ser
                        reaberto primeiro (senão o realizado sumiria do plano mas o
                        registro ficaria no caderno/custos — divergência). */}
                    {item.status === "planejada" && (
                      <button type="button" className="ghost-icon" aria-label="Cancelar operação" onClick={() => patchItem(item.id, { status: "cancelada" })} title="Cancelar operação"><XCircle size={16} /></button>
                    )}
                    {item.status === "cancelada" && (
                      <button type="button" className="ghost-icon" aria-label="Reativar operação" onClick={() => patchItem(item.id, { status: "planejada" })} title="Reativar operação"><Circle size={16} /></button>
                    )}
                    <button type="button" className="danger-icon" aria-label={`Remover ${item.title} do plano`} onClick={() => { if (window.confirm(`Remover "${item.title}" do plano?`)) removeItem(item.id); }} title="Remover do plano"><Trash2 size={16} /></button>
                  </div>
                </article>
              );
            })}
            {itensOrdenados.length === 0 && (
              <section className="empty-state context-empty"><ClipboardList size={28} /><h2>Plano em branco</h2><p>Adicione uma operação manual ou gere a partir do calendário e da 5ª.</p><button type="button" onClick={() => cropPlan.updatePlan(plan.id, { items: gerarItens() })}>Gerar operações agora</button></section>
            )}
          </section>
        </>
      )}
    </div>
  );
}
