import { useEffect, useState } from "react";
import {
  ArrowRight,
  Info,
  Plus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Trash2,
} from "lucide-react";
import type { AppView } from "../../app/navigation";
import {
  diasUteisDesde,
  formatarDataBR,
  hojeISO,
  mediaCampo,
  posicaoFrenteMedia,
  projetarReceita,
  serieCampo,
  ultimaCotacao,
  variacaoCampo,
} from "../../domain/marketQuotes";
import { summarizeCosts, type FieldRecord } from "../../domain/fieldRecords";
import type { AgriculturalController } from "../../lib/useAgriculturalContext";
import { useMarketQuotes } from "./marketStore";
import "./market.css";

const CAMBIO_API = "https://economia.awesomeapi.com.br/last/USD-BRL";

type MarketModuleProps = {
  agriculture: AgriculturalController;
  records: FieldRecord[];
  onNavigate: (view: AppView) => void;
};

const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const nf = (value: number, digits = 2) =>
  value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

function VariationBadge({ variacao }: { variacao: ReturnType<typeof variacaoCampo> }) {
  if (!variacao) return <small className="market-var-none">sem comparação</small>;
  const Icon = variacao.direcao === 1 ? TrendingUp : variacao.direcao === -1 ? TrendingDown : null;
  return (
    <small className="market-var" data-dir={variacao.direcao}>
      {Icon && <Icon size={13} aria-hidden="true" />}
      {variacao.percentual > 0 ? "+" : ""}
      {nf(variacao.percentual, 2)}%
    </small>
  );
}

export function MarketModule({ agriculture, records, onNavigate }: MarketModuleProps) {
  const { quotes, addQuote, removeQuote } = useMarketQuotes();
  const [mostrarForm, setMostrarForm] = useState(false);
  const [cambioAuto, setCambioAuto] = useState<number | null>(null);
  const [sacas, setSacas] = useState(100);

  const [draft, setDraft] = useState({
    data: hojeISO(),
    cepea: "",
    b3: "",
    ice: "",
    conilon: "",
    cambio: "",
    fonte: "CEPEA/ESALQ",
  });

  // Câmbio USD/BRL de API pública — é o único dado que dá para buscar sozinho.
  useEffect(() => {
    let ativo = true;
    fetch(CAMBIO_API)
      .then((resposta) => resposta.json())
      .then((json) => {
        if (!ativo) return;
        const bid = Number(json?.USDBRL?.bid);
        if (Number.isFinite(bid)) setCambioAuto(bid);
      })
      .catch(() => {
        // Sem internet ou API fora: o campo segue manual.
      });
    return () => {
      ativo = false;
    };
  }, []);

  const ultima = ultimaCotacao(quotes);
  const cepeaHoje = ultima?.cepea ?? null;
  const media30 = mediaCampo(quotes, "cepea", 30);
  const media90 = mediaCampo(quotes, "cepea", 90);
  const posicao = posicaoFrenteMedia(cepeaHoje, media90);
  const serie = serieCampo(quotes, "cepea", 90);
  const desatualizada = ultima ? diasUteisDesde(ultima.data) > 2 : false;

  const custos = summarizeCosts(records);
  const projecao = projetarReceita(sacas, cepeaHoje ?? 0, custos.total);

  function submeter(evento: React.FormEvent) {
    evento.preventDefault();
    const numero = (valor: string) => {
      const convertido = Number(valor.replace(",", "."));
      return valor.trim() !== "" && Number.isFinite(convertido) ? convertido : null;
    };

    addQuote({
      data: draft.data,
      cepea: numero(draft.cepea),
      b3: numero(draft.b3),
      ice: numero(draft.ice),
      conilon: numero(draft.conilon),
      cambio: numero(draft.cambio) ?? cambioAuto,
      fonte: draft.fonte.trim() || "Não informada",
    });

    setDraft({ ...draft, cepea: "", b3: "", ice: "", conilon: "", cambio: "" });
    setMostrarForm(false);
  }

  return (
    <div className="page-stack platform-page">
      <header className="page-header context-page-header">
        <div>
          <span className="eyebrow">Monitoramento de mercado</span>
          <h1>Mercado do café</h1>
          <p>
            Histórico de cotações que você acompanha, com médias e variação. Os preços são
            lançados por você — não existe API pública gratuita do CEPEA.
          </p>
        </div>
        <button className="primary-button" type="button" onClick={() => setMostrarForm((v) => !v)}>
          <Plus size={18} /> Lançar cotação
        </button>
      </header>

      {mostrarForm && (
        <form className="panel-card market-form" onSubmit={submeter}>
          <div className="market-form-grid">
            <label>
              Data
              <input
                type="date"
                value={draft.data}
                onChange={(e) => setDraft({ ...draft, data: e.target.value })}
                required
              />
            </label>
            <label>
              Arábica CEPEA (R$/saca)
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={draft.cepea}
                onChange={(e) => setDraft({ ...draft, cepea: e.target.value })}
                placeholder="428.00"
              />
            </label>
            <label>
              Futuro B3 (R$/saca)
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={draft.b3}
                onChange={(e) => setDraft({ ...draft, b3: e.target.value })}
              />
            </label>
            <label>
              ICE NY (US$/lb)
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={draft.ice}
                onChange={(e) => setDraft({ ...draft, ice: e.target.value })}
              />
            </label>
            <label>
              Conilon (R$/saca)
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={draft.conilon}
                onChange={(e) => setDraft({ ...draft, conilon: e.target.value })}
              />
            </label>
            <label>
              Câmbio USD/BRL
              <input
                type="number"
                step="0.0001"
                inputMode="decimal"
                value={draft.cambio}
                onChange={(e) => setDraft({ ...draft, cambio: e.target.value })}
                placeholder={cambioAuto ? cambioAuto.toFixed(4) : ""}
              />
            </label>
            <label>
              Fonte
              <input
                type="text"
                value={draft.fonte}
                onChange={(e) => setDraft({ ...draft, fonte: e.target.value })}
                list="market-fontes"
              />
              <datalist id="market-fontes">
                <option value="CEPEA/ESALQ" />
                <option value="B3" />
                <option value="ICE NY" />
                <option value="Cooperativa" />
                <option value="Corretor" />
              </datalist>
            </label>
          </div>
          <div className="market-form-actions">
            <button className="secondary-button" type="button" onClick={() => setMostrarForm(false)}>
              Cancelar
            </button>
            <button className="primary-button" type="submit">
              Salvar cotação
            </button>
          </div>
        </form>
      )}

      {quotes.length === 0 ? (
        <section className="empty-state context-empty">
          <TrendingUp size={31} />
          <h2>Nenhuma cotação lançada</h2>
          <p>
            Lance o preço que você acompanha (CEPEA, cooperativa, corretor) para começar a ver
            médias, variação e projeção de receita.
          </p>
          <button type="button" onClick={() => setMostrarForm(true)}>
            Lançar primeira cotação
          </button>
        </section>
      ) : (
        <>
          {desatualizada && (
            <p className="market-stale">
              <RefreshCw size={15} aria-hidden="true" /> Última cotação de{" "}
              {formatarDataBR(ultima!.data)} — já se passaram mais de 2 dias úteis. Atualize para
              a leitura ficar confiável.
            </p>
          )}

          <section className="market-cards">
            <article>
              <span>Arábica CEPEA</span>
              <strong>{cepeaHoje !== null ? brl(cepeaHoje) : "—"}</strong>
              <VariationBadge variacao={variacaoCampo(quotes, "cepea")} />
              <small>por saca de 60 kg · {ultima ? formatarDataBR(ultima.data) : "—"}</small>
            </article>
            <article>
              <span>Média 30 dias</span>
              <strong>{media30 !== null ? brl(media30) : "—"}</strong>
              <small>referência de curto prazo</small>
            </article>
            <article>
              <span>Média 90 dias</span>
              <strong>{media90 !== null ? brl(media90) : "—"}</strong>
              <small>referência de médio prazo</small>
            </article>
            <article data-nivel={posicao.nivel}>
              <span>Posição hoje</span>
              <strong>{posicao.rotulo}</strong>
              <small>{posicao.texto}</small>
            </article>
          </section>

          {serie.points.length > 1 && (
            <section className="panel-card">
              <div className="panel-title">
                <TrendingUp size={21} />
                <div>
                  <span className="eyebrow">Últimos 90 dias</span>
                  <h2>Evolução do arábica</h2>
                </div>
              </div>
              <Sparkline points={serie.points} labels={serie.labels} />
            </section>
          )}

          <section className="panel-card">
            <div className="panel-title">
              <Info size={21} />
              <div>
                <span className="eyebrow">
                  {agriculture.selectedProperty?.name ?? "Sua operação"}
                </span>
                <h2>Projeção de receita</h2>
              </div>
            </div>

            <label className="market-sacas">
              Produção esperada (sacas)
              <input
                type="number"
                inputMode="numeric"
                value={sacas}
                onChange={(e) => setSacas(Number(e.target.value))}
              />
            </label>

            <div className="calc-results">
              <div>
                <span>Receita bruta</span>
                <strong>{brl(projecao.receitaBruta)}</strong>
                <small>{sacas} sc × {cepeaHoje !== null ? brl(cepeaHoje) : "—"}</small>
              </div>
              <div>
                <span>Custos registrados</span>
                <strong>{brl(projecao.custoTotal)}</strong>
                <small>{custos.entries} lançamentos no caderno</small>
              </div>
              <div>
                <span>Margem projetada</span>
                <strong>{brl(projecao.margem)}</strong>
                <small>receita − custos lançados</small>
              </div>
            </div>

            <p className="market-note">
              A margem usa apenas os custos já registrados no caderno de campo. Se houver
              despesa não lançada, o número fica otimista.{" "}
              <button
                type="button"
                className="ndvi-inline-link"
                onClick={() => onNavigate("custos")}
              >
                Ver custos <ArrowRight size={13} />
              </button>
            </p>
          </section>

          <section className="panel-card">
            <div className="panel-title">
              <TrendingUp size={21} />
              <div>
                <span className="eyebrow">{quotes.length} lançamentos</span>
                <h2>Histórico</h2>
              </div>
            </div>
            <div className="vr-table-wrap">
              <table className="vr-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>CEPEA</th>
                    <th>B3</th>
                    <th>ICE</th>
                    <th>Câmbio</th>
                    <th>Fonte</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {[...quotes].reverse().slice(0, 20).map((quote) => (
                    <tr key={quote.id}>
                      <td>{formatarDataBR(quote.data)}</td>
                      <td>{quote.cepea != null ? brl(quote.cepea) : "—"}</td>
                      <td>{quote.b3 != null ? brl(quote.b3) : "—"}</td>
                      <td>{quote.ice != null ? `US$ ${nf(quote.ice, 2)}` : "—"}</td>
                      <td>{quote.cambio != null ? nf(quote.cambio, 4) : "—"}</td>
                      <td>{quote.fonte}</td>
                      <td>
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={`Remover cotação de ${formatarDataBR(quote.data)}`}
                          onClick={() => removeQuote(quote.id)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <p className="fert-disclaimer">
        Os indicadores acima são descritivos (média e variação do que você lançou). O AGRYN não
        recomenda comprar, vender ou segurar safra — a decisão de comercialização é sua,
        considerando caixa, contratos e expectativa de produção.
      </p>
    </div>
  );
}

function Sparkline({ points, labels }: { points: number[]; labels: string[] }) {
  const width = 640;
  const height = 160;
  const padding = 28;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;

  const coords = points.map((valor, indice) => {
    const x = padding + (indice / (points.length - 1)) * (width - padding * 2);
    const y = height - padding - ((valor - min) / span) * (height - padding * 2);
    return `${x},${y}`;
  });

  return (
    <svg className="market-spark" viewBox={`0 0 ${width} ${height}`} role="img"
      aria-label={`Evolução do preço de ${labels[0]} a ${labels[labels.length - 1]}`}>
      <polyline points={coords.join(" ")} fill="none" stroke="var(--agryn-emerald-deep, #059669)" strokeWidth="2.5" />
      <text className="market-spark-label" x={padding} y={height - 6}>{labels[0]}</text>
      <text className="market-spark-label" x={width - padding} y={height - 6} textAnchor="end">
        {labels[labels.length - 1]}
      </text>
      <text className="market-spark-label" x={padding} y={16}>{max.toFixed(0)}</text>
      <text className="market-spark-label" x={padding} y={height - padding + 14}>{min.toFixed(0)}</text>
    </svg>
  );
}
