import { ArrowRight, CircleDollarSign, ReceiptText, WalletCards } from "lucide-react";
import type { AppView } from "../../app/navigation";
import { summarizeCosts, type FieldRecord } from "../../domain/fieldRecords";
import type { AgriculturalController } from "../../lib/useAgriculturalContext";

type CostCenterProps = {
  agriculture: AgriculturalController;
  records: FieldRecord[];
  onNavigate: (view: AppView) => void;
};

export function CostCenter({ agriculture, records, onNavigate }: CostCenterProps) {
  const contextualRecords = records.filter((record) => record.plotId === agriculture.selectedPlot?.id);
  const summary = summarizeCosts(contextualRecords);
  const perHectare =
    agriculture.selectedPlot && agriculture.selectedPlot.areaHectares > 0
      ? summary.total / agriculture.selectedPlot.areaHectares
      : 0;

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
