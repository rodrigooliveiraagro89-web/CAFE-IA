import { describe, expect, it } from "vitest";
import {
  diasUteisDesde,
  formatarDataBR,
  mediaCampo,
  posicaoFrenteMedia,
  projetarReceita,
  serieCampo,
  ultimaCotacao,
  variacaoCampo,
  type MarketQuote,
} from "./marketQuotes";

function cotacao(data: string, cepea: number | null, id = data): MarketQuote {
  return { id, data, cepea, fonte: "CEPEA/ESALQ", createdAt: `${data}T12:00:00Z` };
}

const HOJE = "2026-07-23";

describe("ultimaCotacao", () => {
  it("devolve a cotação de data mais recente, independente da ordem da lista", () => {
    const quotes = [cotacao("2026-07-10", 400), cotacao("2026-07-22", 428), cotacao("2026-07-15", 410)];

    expect(ultimaCotacao(quotes)?.data).toBe("2026-07-22");
  });

  it("devolve null sem cotações", () => {
    expect(ultimaCotacao([])).toBeNull();
  });
});

describe("diasUteisDesde", () => {
  it("não conta sábado e domingo", () => {
    // 2026-07-20 é segunda; até quinta 23 são 3 dias úteis (21, 22, 23)
    expect(diasUteisDesde("2026-07-20", HOJE)).toBe(3);
  });

  it("devolve 0 para data futura ou igual a hoje", () => {
    expect(diasUteisDesde(HOJE, HOJE)).toBe(0);
    expect(diasUteisDesde("2026-08-01", HOJE)).toBe(0);
  });
});

describe("mediaCampo", () => {
  it("calcula a média apenas dentro da janela de dias", () => {
    const quotes = [
      cotacao("2026-07-22", 430),
      cotacao("2026-07-20", 410),
      cotacao("2026-01-10", 1000), // fora da janela de 30 dias
    ];

    expect(mediaCampo(quotes, "cepea", 30, HOJE)).toBeCloseTo(420, 6);
  });

  it("ignora cotações sem o campo preenchido", () => {
    const quotes = [cotacao("2026-07-22", 430), cotacao("2026-07-21", null)];

    expect(mediaCampo(quotes, "cepea", 30, HOJE)).toBeCloseTo(430, 6);
  });

  it("devolve null quando não há dado na janela", () => {
    expect(mediaCampo([cotacao("2020-01-01", 300)], "cepea", 30, HOJE)).toBeNull();
  });
});

describe("variacaoCampo", () => {
  it("compara o último ponto com o anterior", () => {
    const quotes = [cotacao("2026-07-21", 400), cotacao("2026-07-22", 420)];
    const variacao = variacaoCampo(quotes, "cepea");

    expect(variacao?.absoluta).toBeCloseTo(20, 6);
    expect(variacao?.percentual).toBeCloseTo(5, 6);
    expect(variacao?.direcao).toBe(1);
  });

  it("marca direção de baixa e de estabilidade", () => {
    expect(variacaoCampo([cotacao("2026-07-21", 420), cotacao("2026-07-22", 400)], "cepea")?.direcao).toBe(-1);
    expect(variacaoCampo([cotacao("2026-07-21", 400), cotacao("2026-07-22", 400)], "cepea")?.direcao).toBe(0);
  });

  it("devolve null com menos de dois pontos", () => {
    expect(variacaoCampo([cotacao("2026-07-22", 400)], "cepea")).toBeNull();
  });
});

describe("serieCampo", () => {
  it("devolve pontos e rótulos em ordem cronológica", () => {
    const quotes = [cotacao("2026-07-22", 428), cotacao("2026-07-20", 410)];
    const serie = serieCampo(quotes, "cepea", 30, HOJE);

    expect(serie.points).toEqual([410, 428]);
    expect(serie.labels).toEqual(["07/20", "07/22"]);
  });
});

describe("posicaoFrenteMedia", () => {
  it("classifica acima, abaixo e em torno da média de 90 dias", () => {
    expect(posicaoFrenteMedia(440, 400).nivel).toBe("acima"); // +10%
    expect(posicaoFrenteMedia(360, 400).nivel).toBe("abaixo"); // -10%
    expect(posicaoFrenteMedia(401, 400).nivel).toBe("media");
  });

  it("não arrisca leitura sem dados", () => {
    expect(posicaoFrenteMedia(null, 400).nivel).toBe("sem-dados");
    expect(posicaoFrenteMedia(400, null).nivel).toBe("sem-dados");
    expect(posicaoFrenteMedia(400, 0).nivel).toBe("sem-dados");
  });

  it("usa os limiares de 3% para não oscilar por ruído", () => {
    expect(posicaoFrenteMedia(412, 400).nivel).toBe("acima"); // exatamente +3%
    expect(posicaoFrenteMedia(410, 400).nivel).toBe("media"); // +2,5%
  });
});

describe("projetarReceita", () => {
  it("calcula receita bruta e margem", () => {
    const projecao = projetarReceita(259, 428, 12110);

    expect(projecao.receitaBruta).toBeCloseTo(110852, 6);
    expect(projecao.margem).toBeCloseTo(98742, 6);
  });

  it("aceita margem negativa quando o custo supera a receita", () => {
    expect(projetarReceita(10, 400, 5000).margem).toBeCloseTo(-1000, 6);
  });
});

describe("formatarDataBR", () => {
  it("converte ISO para dd/mm/aaaa", () => {
    expect(formatarDataBR("2026-07-23")).toBe("23/07/2026");
  });
});
