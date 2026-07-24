import { describe, expect, it } from "vitest";
import {
  calcularEspacamento,
  calcularPulverizacao,
  converterArea,
  gramasPorPlanta,
} from "./calculators";

describe("calcularEspacamento", () => {
  it("calcula o estande do espaçamento clássico de café 3,5 x 0,7 m", () => {
    const result = calcularEspacamento({
      entreLinhas: 3.5,
      entrePlantas: 0.7,
      area: 1,
      dose: 400,
    });

    expect(result.plantasPorHa).toBe(4082);
    expect(result.produtoPorPlanta).toBeCloseTo(400 / 4082, 6);
    expect(result.totalProduto).toBeCloseTo(0.4, 6);
  });

  it("converte a dose total de g/mL para kg/L considerando a área", () => {
    const result = calcularEspacamento({
      entreLinhas: 3,
      entrePlantas: 1,
      area: 10,
      dose: 500,
    });

    // 500 g/ha em 10 ha = 5000 g = 5 kg
    expect(result.totalProduto).toBeCloseTo(5, 6);
  });

  it("não divide por zero quando o espaçamento não foi informado", () => {
    const result = calcularEspacamento({
      entreLinhas: 0,
      entrePlantas: 0.7,
      area: 1,
      dose: 400,
    });

    expect(result.plantasPorHa).toBe(0);
    expect(result.produtoPorPlanta).toBeNull();
  });
});

describe("calcularPulverizacao", () => {
  it("calcula água, produto e número de tanques da operação", () => {
    const result = calcularPulverizacao({
      volumeCalda: 400,
      tanque: 2000,
      dose: 2,
      area: 5,
    });

    expect(result.litrosAguaTotal).toBe(2000);
    // 2 mL/L em 2000 L = 4000 mL = 4 L
    expect(result.produtoTotal).toBeCloseTo(4, 6);
    expect(result.numeroTanques).toBe(1);
  });

  it("arredonda o número de tanques para cima (tanque parcial ainda é uma viagem)", () => {
    const result = calcularPulverizacao({
      volumeCalda: 400,
      tanque: 2000,
      dose: 2,
      area: 6,
    });

    expect(result.litrosAguaTotal).toBe(2400);
    expect(result.numeroTanques).toBe(2);
  });

  it("não divide por zero quando a capacidade do tanque não foi informada", () => {
    const result = calcularPulverizacao({
      volumeCalda: 400,
      tanque: 0,
      dose: 2,
      area: 5,
    });

    expect(result.numeroTanques).toBe(0);
  });
});

describe("converterArea", () => {
  it("converte hectares para m² e alqueires", () => {
    const result = converterArea(1);

    expect(result.metrosQuadrados).toBe(10_000);
    expect(result.alqueirePaulista).toBeCloseTo(0.413, 3);
    expect(result.alqueireMineiro).toBeCloseTo(0.207, 3);
  });

  it("mantém a proporção de 1 alqueire paulista = 2,42 ha", () => {
    expect(converterArea(2.42).alqueirePaulista).toBeCloseTo(1, 6);
    expect(converterArea(4.84).alqueireMineiro).toBeCloseTo(1, 6);
  });
});

describe("gramasPorPlanta", () => {
  it("converte kg/ha em g/planta usando o estande", () => {
    // 400 kg/ha com 4000 plantas/ha = 100 g/planta
    expect(gramasPorPlanta(400, 4000)).toBeCloseTo(100, 6);
  });

  it("retorna null sem estande, em vez de dividir por zero", () => {
    expect(gramasPorPlanta(400, 0)).toBeNull();
  });
});
