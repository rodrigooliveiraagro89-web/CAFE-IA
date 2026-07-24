import { describe, expect, it } from "vitest";
import {
  calcularCalagem,
  cmolcParaMmolc,
  kMgParaMmolc,
  recomendarAdubacao,
  sacasParaKgHa,
} from "./fertilization";

describe("conversões de unidade", () => {
  it("converte K de mg/dm³ para mmolc/dm³ pela massa equivalente", () => {
    // 39,1 mg/dm³ de K = 1 mmolc/dm³
    expect(kMgParaMmolc(39.1)).toBeCloseTo(1, 6);
    // Um K de 60 mg/dm³ (comum em laudo) = 1,53 mmolc → classe 1,6–3,0
    expect(kMgParaMmolc(60)).toBeCloseTo(1.5345, 4);
  });

  it("converte cmolc para mmolc multiplicando por 10", () => {
    expect(cmolcParaMmolc(8.5)).toBe(85);
  });
});

describe("calcularCalagem", () => {
  it("reproduz o exemplo oficial do Boletim 100 (CTC 85 mmolc, V1 42% → ~1,6 t/ha)", () => {
    const result = calcularCalagem({ ctcCmolc: 8.5, vAtual: 42 });

    expect(result.toneladasPorHectare).toBeCloseTo(1.61, 2);
    expect(result.dispensada).toBe(false);
    expect(result.vAlvo).toBe(60);
    expect(result.prnt).toBe(95);
  });

  it("dispensa calagem quando o V% já atingiu o alvo", () => {
    const result = calcularCalagem({ ctcCmolc: 8.5, vAtual: 65 });

    expect(result.toneladasPorHectare).toBe(0);
    expect(result.dispensada).toBe(true);
  });

  it("exige mais calcário quanto menor a saturação atual", () => {
    const pouco = calcularCalagem({ ctcCmolc: 8, vAtual: 50 });
    const muito = calcularCalagem({ ctcCmolc: 8, vAtual: 30 });

    expect(muito.toneladasPorHectare).toBeGreaterThan(pouco.toneladasPorHectare);
  });

  it("respeita um PRNT diferente do padrão", () => {
    const padrao = calcularCalagem({ ctcCmolc: 8, vAtual: 40 });
    const fraco = calcularCalagem({ ctcCmolc: 8, vAtual: 40, prnt: 70 });

    // Calcário mais fraco exige mais tonelagem para o mesmo efeito
    expect(fraco.toneladasPorHectare).toBeGreaterThan(padrao.toneladasPorHectare);
  });
});

describe("recomendarAdubacao", () => {
  it("lê a tabela do Boletim 100 na faixa 2.400–3.600 kg/ha com solo médio", () => {
    const result = recomendarAdubacao({
      produtividadeKgHa: 3000,
      nFoliar: 28, // classe 26–30
      pResina: 8, // classe 6–12
      kMgPorDm3: 40, // ~1,02 mmolc → classe 0,8–1,5
    });

    expect(result.n).toBe(200);
    expect(result.p2o5).toBe(60);
    expect(result.k2o).toBe(200);
    expect(result.suposicoes).toHaveLength(0);
  });

  it("zera o P₂O₅ quando o fósforo do solo está alto em baixa produtividade", () => {
    const result = recomendarAdubacao({
      produtividadeKgHa: 1500,
      pResina: 45, // > 30
      kMgPorDm3: 40,
      nFoliar: 28,
    });

    expect(result.p2o5).toBe(0);
  });

  it("aumenta o N quando o teor foliar está baixo", () => {
    const base = { produtividadeKgHa: 3000, pResina: 8, kMgPorDm3: 40 };
    const carente = recomendarAdubacao({ ...base, nFoliar: 22 });
    const adequado = recomendarAdubacao({ ...base, nFoliar: 28 });
    const alto = recomendarAdubacao({ ...base, nFoliar: 33 });

    expect(carente.n).toBe(300);
    expect(adequado.n).toBe(200);
    expect(alto.n).toBe(140);
  });

  it("usa a conversão de K: 120 mg/dm³ cai na classe 1,6–3,0, não na média", () => {
    // 120 / 39,1 = 3,07 mmolc → classe > 3,0
    const result = recomendarAdubacao({
      produtividadeKgHa: 3000,
      nFoliar: 28,
      pResina: 8,
      kMgPorDm3: 120,
    });

    expect(result.k2o).toBe(80);
  });

  it("declara as suposições quando faltam dados, em vez de inventar", () => {
    const result = recomendarAdubacao({ produtividadeKgHa: 3000 });

    expect(result.suposicoes).toHaveLength(3);
    expect(result.suposicoes.join(" ")).toContain("foliar");
    // Cai nas colunas médias
    expect(result.n).toBe(200);
    expect(result.p2o5).toBe(60);
    expect(result.k2o).toBe(200);
  });

  it("calcula o enxofre como 1/8 do N e dispensa com S alto no solo", () => {
    const semS = recomendarAdubacao({
      produtividadeKgHa: 3000,
      nFoliar: 28,
      pResina: 8,
      kMgPorDm3: 40,
    });
    expect(semS.s).toBe(25); // 200 / 8

    const comS = recomendarAdubacao({
      produtividadeKgHa: 3000,
      nFoliar: 28,
      pResina: 8,
      kMgPorDm3: 40,
      sMgPorDm3: 14, // > 10 mg/dm³
    });
    expect(comS.s).toBe(0);
  });

  it("usa a última faixa da tabela para produtividade acima de 4.800 kg/ha", () => {
    const result = recomendarAdubacao({
      produtividadeKgHa: 6000,
      nFoliar: 28,
      pResina: 8,
      kMgPorDm3: 40,
    });

    expect(result.n).toBe(300);
    expect(result.k2o).toBe(300);
  });
});

describe("sacasParaKgHa", () => {
  it("converte sacas de 60 kg em kg/ha beneficiado", () => {
    expect(sacasParaKgHa(45)).toBe(2700);
  });
});
