import { describe, expect, it } from "vitest";
import {
  acharCultivar,
  calcularRentabilidade,
  ehMorango,
  CULTIVARES,
} from "./strawberry";

describe("ehMorango", () => {
  it("reconhece morango em variações de texto da cultura", () => {
    expect(ehMorango("Morango")).toBe(true);
    expect(ehMorango("morango (Estiva)")).toBe(true);
    expect(ehMorango("Strawberry")).toBe(true);
  });

  it("não confunde com outras culturas", () => {
    expect(ehMorango("Café arábica")).toBe(false);
    expect(ehMorango("Milho")).toBe(false);
  });
});

describe("acharCultivar", () => {
  it("acha a cultivar ignorando caixa e espaços", () => {
    expect(acharCultivar(" albion ")?.tipo).toBe("dia-neutro");
    expect(acharCultivar("Festival")?.tipo).toBe("dia-curto");
  });

  it("devolve null para cultivar desconhecida", () => {
    expect(acharCultivar("Inexistente")).toBeNull();
  });

  it("tem tipo de fotoperíodo declarado para toda cultivar do catálogo", () => {
    for (const cultivar of CULTIVARES) {
      expect(["dia-neutro", "dia-curto"]).toContain(cultivar.tipo);
    }
  });
});

describe("calcularRentabilidade", () => {
  it("calcula receita, margem e retorno sobre o custo", () => {
    // 80 t/ha x 1000 kg x R$ 4,50 = R$ 360.000/ha
    const result = calcularRentabilidade({
      toneladasPorHectare: 80,
      precoPorKg: 4.5,
      custoPorHectare: 120000,
    });

    expect(result.receitaPorHectare).toBeCloseTo(360000, 6);
    expect(result.margemPorHectare).toBeCloseTo(240000, 6);
    expect(result.retornoPercentual).toBeCloseTo(200, 6);
  });

  it("não divide por zero quando não há custo registrado", () => {
    const result = calcularRentabilidade({
      toneladasPorHectare: 60,
      precoPorKg: 4,
      custoPorHectare: 0,
    });

    expect(result.retornoPercentual).toBeNull();
    expect(result.margemPorHectare).toBeCloseTo(240000, 6);
  });

  it("aceita margem negativa quando o custo supera a receita", () => {
    const result = calcularRentabilidade({
      toneladasPorHectare: 10,
      precoPorKg: 3,
      custoPorHectare: 50000,
    });

    expect(result.margemPorHectare).toBeCloseTo(-20000, 6);
    expect(result.retornoPercentual).toBeCloseTo(-40, 6);
  });
});
