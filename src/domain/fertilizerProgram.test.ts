import { describe, expect, it } from "vitest";
import { PRECO_PADRAO_KG, custoPorHectare, gramasPorPlanta, montarPrograma } from "./fertilizerProgram";

describe("montarPrograma", () => {
  it("fecha N, P e K com MAP + 27-00-10 + KCl (K alto)", () => {
    // Alvo Casa 1 médio: N 200, P₂O₅ 60, K₂O 80.
    const r = montarPrograma({ n: 200, p2o5: 60, k2o: 80 }, { fonteP: "map", cobertura: "270010", fonteK: "kcl" });
    const map = r.itens.find((i) => i.formula === "11-52-00");
    const cob = r.itens.find((i) => i.formula === "27-00-10");
    expect(map?.kgPorHectare).toBeCloseTo(115.4, 0);
    expect(cob).toBeTruthy();
    // Entrega os alvos (com folga <=15%)
    expect(r.entregue.n).toBeGreaterThanOrEqual(199);
    expect(r.entregue.p2o5).toBeGreaterThanOrEqual(59);
    expect(r.entregue.k2o).toBeGreaterThanOrEqual(79);
    // 27-00-10 usa bem menos adubo que 20-00-20 aqui
    expect(r.totalKgPorHectare).toBeLessThan(900);
  });

  it("com 20-00-20 entrega K em excesso (mais adubo)", () => {
    const r = montarPrograma({ n: 200, p2o5: 60, k2o: 80 }, { fonteP: "map", cobertura: "200020", fonteK: "kcl" });
    expect(r.entregue.k2o).toBeGreaterThan(150); // excesso de potássio
    expect(r.totalKgPorHectare).toBeGreaterThan(1000);
  });

  it("não usa fonte de P quando P₂O₅ alvo é zero", () => {
    const r = montarPrograma({ n: 140, p2o5: 0, k2o: 40 }, { fonteP: "map", cobertura: "270010", fonteK: "kcl" });
    expect(r.itens.some((i) => i.formula === "11-52-00")).toBe(false);
  });

  it("dispensa complemento de K quando a cobertura já entrega o K₂O", () => {
    const r = montarPrograma({ n: 200, p2o5: 0, k2o: 80 }, { fonteP: "none", cobertura: "200020", fonteK: "kcl" });
    expect(r.itens.some((i) => i.formula === "00-00-60")).toBe(false);
  });

  it("sulfato de amônio entrega enxofre", () => {
    const r = montarPrograma({ n: 200, p2o5: 0, k2o: 40 }, { fonteP: "none", cobertura: "sulfam", fonteK: "kcl" });
    expect(r.entregue.s).toBeGreaterThan(100);
  });
});

describe("custoPorHectare", () => {
  it("soma kg × preço de cada insumo", () => {
    const prog = montarPrograma({ n: 200, p2o5: 60, k2o: 80 }, { fonteP: "map", cobertura: "270010", fonteK: "kcl" });
    const custo = custoPorHectare(prog, PRECO_PADRAO_KG);
    // ~115kg MAP*4,2 + ~694kg 27-00-10*3,6 + ~18kg KCl*3,9 -> alguns milhares de R$
    expect(custo).toBeGreaterThan(2000);
    expect(custo).toBeLessThan(4000);
  });

  it("preço ausente conta como zero (não quebra)", () => {
    const prog = montarPrograma({ n: 100, p2o5: 0, k2o: 40 }, { fonteP: "none", cobertura: "270010", fonteK: "kcl" });
    expect(custoPorHectare(prog, {})).toBe(0);
  });
});

describe("gramasPorPlanta", () => {
  it("converte kg/ha para g/planta", () => {
    expect(gramasPorPlanta(694, 4082)).toBeCloseTo(170, 0);
  });
  it("retorna null sem população", () => {
    expect(gramasPorPlanta(100, 0)).toBeNull();
  });
});
