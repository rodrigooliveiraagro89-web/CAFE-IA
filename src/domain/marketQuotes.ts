/**
 * Cotações de café — lógica pura portada do app clássico (agryn.html).
 *
 * Não existe API pública e gratuita do CEPEA/B3 para preço de café, por isso o
 * histórico é alimentado manualmente pelo usuário (a fonte fica registrada em
 * cada lançamento). Só o câmbio USD/BRL vem de API pública.
 *
 * Todos os indicadores abaixo são DESCRITIVOS (média, variação, posição frente à
 * média de 90 dias). O app não emite ordem de compra ou venda: a decisão de
 * comercializar a safra é do produtor.
 */

export type MarketField = "cepea" | "b3" | "ice" | "conilon" | "cambio";

export type MarketQuote = {
  id: string;
  /** Data no formato ISO (YYYY-MM-DD). */
  data: string;
  /** Arábica CEPEA/ESALQ, em R$/saca de 60 kg. */
  cepea?: number | null;
  /** Futuro doméstico B3, em R$/saca. */
  b3?: number | null;
  /** Futuro ICE NY, em US$/libra-peso. */
  ice?: number | null;
  /** Conilon/robusta, em R$/saca. */
  conilon?: number | null;
  /** Câmbio USD/BRL. */
  cambio?: number | null;
  fonte: string;
  createdAt: string;
};

export function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatarDataBR(iso: string): string {
  const partes = iso.split("-");
  return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : iso;
}

function ordenarPorData(quotes: MarketQuote[]): MarketQuote[] {
  return [...quotes].sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
}

export function ultimaCotacao(quotes: MarketQuote[]): MarketQuote | null {
  const ordenadas = ordenarPorData(quotes);
  return ordenadas.length ? ordenadas[ordenadas.length - 1] : null;
}

/** Quantos dias úteis (seg–sex) se passaram desde a data informada. */
export function diasUteisDesde(iso: string, hoje: string = hojeISO()): number {
  if (!iso) return 999;
  const inicio = new Date(`${iso}T00:00:00`);
  const fim = new Date(`${hoje}T00:00:00`);
  if (Number.isNaN(inicio.getTime()) || fim <= inicio) return 0;

  let dias = 0;
  const cursor = new Date(inicio);
  while (cursor < fim) {
    cursor.setDate(cursor.getDate() + 1);
    const diaSemana = cursor.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) dias += 1;
  }
  return dias;
}

/** Média de um campo nos últimos `dias` dias corridos. */
export function mediaCampo(
  quotes: MarketQuote[],
  campo: MarketField,
  dias: number,
  hoje: string = hojeISO(),
): number | null {
  const limite = new Date(`${hoje}T00:00:00`);
  limite.setDate(limite.getDate() - dias);

  const valores = quotes
    .filter((quote) => {
      const valor = quote[campo];
      return (
        valor !== null &&
        valor !== undefined &&
        new Date(`${quote.data}T00:00:00`) >= limite
      );
    })
    .map((quote) => Number(quote[campo]))
    .filter((valor) => Number.isFinite(valor));

  if (!valores.length) return null;
  return valores.reduce((soma, valor) => soma + valor, 0) / valores.length;
}

export type Variacao = {
  absoluta: number;
  percentual: number;
  /** 1 alta, -1 baixa, 0 estável. */
  direcao: 1 | 0 | -1;
};

/** Variação do último ponto frente ao anterior, no mesmo campo. */
export function variacaoCampo(quotes: MarketQuote[], campo: MarketField): Variacao | null {
  const valores = ordenarPorData(quotes)
    .filter((quote) => quote[campo] !== null && quote[campo] !== undefined)
    .map((quote) => Number(quote[campo]));

  if (valores.length < 2) return null;
  const atual = valores[valores.length - 1];
  const anterior = valores[valores.length - 2];
  if (!anterior) return null;

  const percentual = ((atual - anterior) / anterior) * 100;
  return {
    absoluta: atual - anterior,
    percentual,
    direcao: percentual > 0.05 ? 1 : percentual < -0.05 ? -1 : 0,
  };
}

export type Serie = { points: number[]; labels: string[] };

/** Série de um campo nos últimos `dias` dias, para o gráfico. */
export function serieCampo(
  quotes: MarketQuote[],
  campo: MarketField,
  dias: number,
  hoje: string = hojeISO(),
): Serie {
  const limite = new Date(`${hoje}T00:00:00`);
  limite.setDate(limite.getDate() - dias);

  const filtradas = ordenarPorData(quotes).filter((quote) => {
    const valor = quote[campo];
    return (
      valor !== null && valor !== undefined && new Date(`${quote.data}T00:00:00`) >= limite
    );
  });

  return {
    points: filtradas.map((quote) => Number(quote[campo])),
    labels: filtradas.map((quote) => quote.data.slice(5).replace("-", "/")),
  };
}

export type PosicaoMercado = {
  nivel: "acima" | "abaixo" | "media" | "sem-dados";
  rotulo: string;
  texto: string;
};

/**
 * Posição do preço atual frente à média de 90 dias. É uma LEITURA DESCRITIVA de
 * onde o preço está, não uma ordem de compra ou venda — a decisão de
 * comercializar é do produtor, considerando caixa, contratos e expectativa.
 */
export function posicaoFrenteMedia(
  cepeaHoje: number | null,
  media90: number | null,
): PosicaoMercado {
  if (cepeaHoje === null || media90 === null || media90 === 0) {
    return {
      nivel: "sem-dados",
      rotulo: "Sem leitura",
      texto:
        "Histórico ainda curto. Cadastre os preços dos próximos dias para o indicador ganhar base.",
    };
  }

  const razao = cepeaHoje / media90;
  if (razao >= 1.03) {
    return {
      nivel: "acima",
      rotulo: "Acima da média",
      texto: "Preço acima da média dos últimos 90 dias.",
    };
  }
  if (razao <= 0.97) {
    return {
      nivel: "abaixo",
      rotulo: "Abaixo da média",
      texto: "Preço abaixo da média dos últimos 90 dias.",
    };
  }
  return {
    nivel: "media",
    rotulo: "Em torno da média",
    texto: "Preço próximo da média dos últimos 90 dias.",
  };
}

export type Projecao = {
  receitaBruta: number;
  custoTotal: number;
  margem: number;
};

/** Projeção simples de receita a partir das sacas esperadas e do preço. */
export function projetarReceita(
  sacas: number,
  precoPorSaca: number,
  custoTotal: number,
): Projecao {
  const receitaBruta = sacas * precoPorSaca;
  return { receitaBruta, custoTotal, margem: receitaBruta - custoTotal };
}
