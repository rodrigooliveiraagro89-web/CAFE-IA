import { useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  CircleDollarSign,
  ClipboardList,
  Info,
  Sprout,
} from "lucide-react";
import type { AppView } from "../../app/navigation";
import { summarizeCosts, type FieldRecord } from "../../domain/fieldRecords";
import {
  acharCultivar,
  calcularRentabilidade,
  ehMorango,
  FASES,
  METAS_PRODUTIVIDADE,
} from "../../domain/strawberry";
import type { AgriculturalController } from "../../lib/useAgriculturalContext";
import "./strawberry.css";

type MorangoModuleProps = {
  agriculture: AgriculturalController;
  records: FieldRecord[];
  onNavigate: (view: AppView) => void;
};

const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const nf = (value: number, digits = 0) =>
  value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function MorangoModule({ agriculture, records, onNavigate }: MorangoModuleProps) {
  const [meta, setMeta] = useState<number>(80);
  const [precoKg, setPrecoKg] = useState(4.5);

  const plot = agriculture.selectedPlot;

  if (!plot) {
    return (
      <div className="page-stack platform-page">
        <header className="page-header">
          <div>
            <span className="eyebrow">Cultura do morango</span>
            <h1>Morango</h1>
          </div>
        </header>
        <section className="empty-state context-empty">
          <Sprout size={31} />
          <h2>Selecione um talhão</h2>
          <p>O painel do morango é montado para a área e o histórico de um talhão.</p>
          <button type="button" onClick={() => onNavigate("propriedades")}>
            Selecionar talhão
          </button>
        </section>
      </div>
    );
  }

  const plotRecords = records.filter((record) => record.plotId === plot.id);
  const planejadas = plotRecords.filter((record) => record.status === "planejada");
  const concluidas = plotRecords.filter((record) => record.status === "concluida");
  const custos = summarizeCosts(plotRecords);
  const custoPorHectare = plot.areaHectares > 0 ? custos.total / plot.areaHectares : 0;

  const cultivar = acharCultivar(plot.crop.replace(/morango|\(|\)/gi, "").trim());
  const rentabilidade = calcularRentabilidade({
    toneladasPorHectare: meta,
    precoPorKg: precoKg,
    custoPorHectare,
  });

  const naoEhMorango = !ehMorango(plot.crop);

  return (
    <div className="page-stack platform-page">
      <header className="page-header context-page-header">
        <div>
          <span className="eyebrow">Cultura do morango · Sul de Minas</span>
          <h1>Morango — {plot.name}</h1>
          <p>Planejamento, operação e financeiro do talhão num painel só.</p>
        </div>
        <button className="secondary-button" type="button" onClick={() => onNavigate("caderno")}>
          Abrir caderno <ArrowRight size={17} />
        </button>
      </header>

      {naoEhMorango && (
        <p className="morango-warning">
          <Info size={16} aria-hidden="true" /> O talhão <strong>{plot.name}</strong> está
          cadastrado como <strong>{plot.crop}</strong>, não morango. O painel funciona, mas as
          referências de cultivar assumem morango.
        </p>
      )}

      <div className="morango-grid">
        <section className="panel-card morango-panel">
          <div className="panel-title">
            <CalendarClock size={20} />
            <div>
              <span className="eyebrow">Planejamento</span>
              <h2>Ciclo e próximos passos</h2>
            </div>
          </div>
          <ul className="morango-list">
            <li>
              <span>Cultura / safra</span>
              <strong>{plot.crop} · {plot.season}</strong>
            </li>
            <li>
              <span>Cultivar</span>
              <strong>
                {cultivar ? `${cultivar.nome} (${cultivar.tipo})` : "Não identificada"}
              </strong>
            </li>
            <li>
              <span>Atividades planejadas</span>
              <strong>{planejadas.length}</strong>
            </li>
          </ul>
          {cultivar && <p className="morango-hint">{cultivar.nota}</p>}
          {planejadas.length > 0 ? (
            <ul className="morango-tasks">
              {planejadas.slice(0, 4).map((record) => (
                <li key={record.id}>{record.title}</li>
              ))}
            </ul>
          ) : (
            <button
              type="button"
              className="ndvi-inline-link"
              onClick={() => onNavigate("caderno")}
            >
              Programar atividade
            </button>
          )}
        </section>

        <section className="panel-card morango-panel">
          <div className="panel-title">
            <ClipboardList size={20} />
            <div>
              <span className="eyebrow">Operacional</span>
              <h2>O que já foi feito</h2>
            </div>
          </div>
          <ul className="morango-list">
            <li>
              <span>Atividades concluídas</span>
              <strong>{concluidas.length}</strong>
            </li>
            <li>
              <span>Registros no talhão</span>
              <strong>{plotRecords.length}</strong>
            </li>
            <li>
              <span>Área</span>
              <strong>{nf(plot.areaHectares, 2)} ha</strong>
            </li>
          </ul>
          {concluidas.length > 0 ? (
            <ul className="morango-tasks">
              {concluidas.slice(-4).reverse().map((record) => (
                <li key={record.id}>{record.title}</li>
              ))}
            </ul>
          ) : (
            <p className="morango-hint">Nenhuma atividade concluída registrada ainda.</p>
          )}
        </section>

        <section className="panel-card morango-panel">
          <div className="panel-title">
            <CircleDollarSign size={20} />
            <div>
              <span className="eyebrow">Financeiro</span>
              <h2>Custo e rentabilidade</h2>
            </div>
          </div>
          <ul className="morango-list">
            <li>
              <span>Custo acumulado</span>
              <strong>{custos.total > 0 ? brl(custos.total) : "Não informado"}</strong>
            </li>
            <li>
              <span>Custo por hectare</span>
              <strong>{custoPorHectare > 0 ? brl(custoPorHectare) : "—"}</strong>
            </li>
            <li>
              <span>Receita projetada/ha</span>
              <strong>{brl(rentabilidade.receitaPorHectare)}</strong>
            </li>
            <li>
              <span>Retorno sobre custo</span>
              <strong data-positivo={rentabilidade.margemPorHectare >= 0}>
                {rentabilidade.retornoPercentual !== null
                  ? `${nf(rentabilidade.retornoPercentual, 0)}%`
                  : "registre custos"}
              </strong>
            </li>
          </ul>
        </section>
      </div>

      <section className="panel-card">
        <div className="panel-title">
          <Sprout size={21} />
          <div>
            <span className="eyebrow">Cenário de produção</span>
            <h2>Projeção de receita</h2>
          </div>
        </div>

        <div className="morango-scenarios" role="group" aria-label="Meta de produtividade">
          {METAS_PRODUTIVIDADE.map((valor) => (
            <button
              key={valor}
              type="button"
              data-active={valor === meta}
              onClick={() => setMeta(valor)}
            >
              <strong>{valor} t/ha</strong>
            </button>
          ))}
        </div>

        <label className="morango-price">
          Preço recebido (R$/kg)
          <input
            type="number"
            step="0.10"
            inputMode="decimal"
            value={precoKg}
            onChange={(event) => setPrecoKg(Number(event.target.value))}
          />
        </label>

        <div className="calc-results">
          <div>
            <span>Receita por hectare</span>
            <strong>{brl(rentabilidade.receitaPorHectare)}</strong>
            <small>{meta} t/ha × {brl(precoKg)}/kg</small>
          </div>
          <div>
            <span>Custo por hectare</span>
            <strong>{custoPorHectare > 0 ? brl(custoPorHectare) : "—"}</strong>
            <small>{custos.entries} lançamentos</small>
          </div>
          <div>
            <span>Margem por hectare</span>
            <strong>{brl(rentabilidade.margemPorHectare)}</strong>
            <small>receita − custo</small>
          </div>
        </div>
      </section>

      <section className="panel-card">
        <div className="panel-title">
          <CalendarClock size={21} />
          <div>
            <span className="eyebrow">Referência</span>
            <h2>Fases do ciclo</h2>
          </div>
        </div>
        <ol className="morango-fases">
          {FASES.map((fase) => (
            <li key={fase.id}>
              <strong>{fase.nome}</strong>
              <span>{fase.foco}</span>
            </li>
          ))}
        </ol>
      </section>

      <p className="fert-disclaimer">
        Referências gerais para morango de cultivo protegido no Sul de Minas. A lâmina de
        irrigação e o programa de fertirrigação dependem de substrato, clima e fase, e devem ser
        definidos pelo agrônomo responsável — o app não estima milímetros sem base de campo.
      </p>
    </div>
  );
}
