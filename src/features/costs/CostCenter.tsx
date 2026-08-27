import { ArrowRight, CalendarRange, CircleDollarSign, ReceiptText, Target, WalletCards } from "lucide-react";
import type { AppView } from "../../app/navigation";
import { summarizeCosts, type FieldRecord } from "../../domain/fieldRecords";
import { findPlanForPlot, planCostByCategory, summarizePlan } from "../../domain/cropPlan";
import type { AgriculturalController } from "../../lib/useAgriculturalContext";
import type { CropPlanController } from "../cropplan/useCropPlan";
import "./costs.css";

type CostCenterProps = {
  agriculture: AgriculturalController;
  records: FieldRecord[];
  cropPlan: CropPlanController;
  onNavigate: (view: AppView) => void;
};

// Mesmo formato (com centavos) do resto da tela e do caderno, para o realizado
// (derivado dos field_records) fechar visualmente com os lançamentos.
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function CostCenter({ agriculture, records, cropPlan, onNavigate }: CostCenterProps) {
  const plot = agriculture.selectedPlot;
  const contextualRecords = records.filter((record) => record.plotId === plot?.id);
  const summary = summarizeCosts(contextualRecords);
  const perHectare =
    plot && plot.areaHectares > 0 ? summary.total / plot.areaHectares : 0;

  // Plano da safra atual do talhão (mesma chave (talhão × safra) do módulo).
  const plan = plot ? findPlanForPlot(cropPlan.plans, plot.id, plot.season) : null;
  const planSummary = plan ? summarizePlan(plan, contextualRecords) : null;
  const planCats = plan ? planCostByCategory(plan, contextualRecords) : [];
  const maxCat = planCats.reduce((m, c) => Math.max(m, c.planned, c.realized), 0);
  // Variação só faz sentido quando HÁ previsto E HÁ realizado. Um plano recém
  // criado (realizado 0) ou sem custo previsto informado não deve afirmar
  // "acima/abaixo do previsto" — isso confundiria (economia/estouro fantasma).
  const temPrevisto = (planSummary?.plannedTotal ?? 0) > 0;
  const temRealizado = (planSummary?.realizedTotal ?? 0) > 0;
  const podeComparar = temPrevisto && temRealizado;
  const variacao = planSummary ? planSummary.realizedTotal - planSummary.plannedTotal : 0;
  const varSinal = !podeComparar ? "flat" : variacao > 0 ? "over" : variacao < 0 ? "under" : "flat";
  const varRotulo = !podeComparar
    ? temPrevisto
      ? "Aguardando execução"
      : "Sem previsto informado"
    : varSinal === "over"
      ? "Acima do previsto"
      : varSinal === "under"
        ? "Abaixo do previsto"
        : "Em linha com o previsto";

  return (
    <div className="page-stack platform-page">
      <header className="page-header context-page-header">
        <div><span className="eyebrow">Gestão financeira por área</span><h1>Centro de custos</h1><p>Valores consolidados somente a partir das atividades registradas no caderno de campo.</p></div>
        <button className="secondary-button" type="button" onClick={() => onNavigate("caderno")}>Abrir caderno <ArrowRight size={17} /></button>
      </header>

      {!agriculture.selectedPlot ? (
        <section className="empty-state context-empty"><CircleDollarSign size={31} /><h2>Selecione um talhão</h2><p>O custo precisa de uma área produtiva para ser calculado corretamente.</p><button type="button" onClick={() => onNavigate("propriedades")}>Selecionar talhão</button></section>
      ) : (
        <>
          <section className="finance-summary">
            <article><span><CircleDollarSign size={20} /> Total registrado</span><strong>{summary.total > 0 ? summary.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "Não informado"}</strong><small>{summary.entries} lançamentos com valor</small></article>
            <article><span><WalletCards size={20} /> Custo por hectare</span><strong>{perHectare > 0 ? perHectare.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "Não calculado"}</strong><small>{agriculture.selectedPlot.areaHectares.toLocaleString("pt-BR")} ha no talhão</small></article>
            <article><span><ReceiptText size={20} /> Categorias</span><strong>{Object.keys(summary.byCategory).length || "—"}</strong><small>Classificação pelo tipo da atividade</small></article>
          </section>

          {plan ? (
            <section className="panel-card cost-plan">
              <div className="panel-title"><Target size={21} /><div><span className="eyebrow">{plan.safra}</span><h2>Plano de safra — previsto × realizado</h2></div></div>
              <div className="cost-plan-totals">
                <div><span>Previsto</span><strong>{planSummary && planSummary.plannedTotal > 0 ? brl(planSummary.plannedTotal) : "—"}</strong></div>
                <div><span>Realizado</span><strong>{planSummary && planSummary.realizedTotal > 0 ? brl(planSummary.realizedTotal) : "—"}</strong></div>
                <div className="cost-plan-var" data-sign={varSinal}>
                  <span>{varRotulo}</span>
                  <strong>{podeComparar && variacao !== 0 ? `${variacao > 0 ? "+" : "−"}${brl(Math.abs(variacao))}` : "—"}</strong>
                </div>
              </div>
              {planCats.length > 0 ? (
                <div className="cost-plan-cats">
                  {planCats.map((c) => (
                    <div key={c.kind} className="cost-plan-cat">
                      <span><strong>{c.label}</strong><small>prev. {brl(c.planned)} · real. {brl(c.realized)}</small></span>
                      <div className="cost-plan-track">
                        <i className="prev" style={{ width: `${maxCat > 0 ? (c.planned / maxCat) * 100 : 0}%`, minWidth: c.planned > 0 ? undefined : 0 }} />
                        <i className="real" style={{ width: `${maxCat > 0 ? (c.realized / maxCat) * 100 : 0}%`, minWidth: c.realized > 0 ? undefined : 0 }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="cost-plan-empty">Defina o custo previsto das operações no plano de safra para acompanhar previsto × realizado aqui.</p>
              )}
              <button className="secondary-button cost-plan-open" type="button" onClick={() => onNavigate("plano-safra")}>Abrir plano de safra <CalendarRange size={16} /></button>
            </section>
          ) : (
            <section className="panel-card cost-plan cost-plan-cta">
              <div className="panel-title"><Target size={21} /><div><span className="eyebrow">Manejo planejado</span><h2>Sem plano de safra neste talhão</h2></div></div>
              <p>Crie o plano da safra para orçar as operações e comparar com o que foi de fato gasto no caderno.</p>
              <button className="secondary-button cost-plan-open" type="button" onClick={() => onNavigate("plano-safra")}>Criar plano de safra <CalendarRange size={16} /></button>
            </section>
          )}

          {summary.entries === 0 ? (
            <section className="empty-state context-empty"><ReceiptText size={31} /><h2>Nenhum custo registrado</h2><p>Adicione um valor a uma atividade do caderno para compor esta visão.</p><button type="button" onClick={() => onNavigate("caderno")}>Registrar atividade</button></section>
          ) : (
            <section className="panel-card">
              <div className="panel-title"><ReceiptText size={21} /><div><span className="eyebrow">{agriculture.selectedPlot.name}</span><h2>Custos por categoria</h2></div></div>
              <div className="cost-breakdown">
                {Object.entries(summary.byCategory).sort(([, left], [, right]) => right - left).map(([category, value]) => (
                  <div key={category}><span><strong>{category}</strong><small>{((value / summary.total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</small></span><div className="cost-bar"><i style={{ width: `${(value / summary.total) * 100}%` }} /></div><strong>{value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong></div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
