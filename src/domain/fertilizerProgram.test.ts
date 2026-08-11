import { describe, expect, it } from "vitest";
import { gramasPorPlanta, montarPrograma } from "./fertilizerProgram";

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

describe("gramasPorPlanta", () => {
  it("converte kg/ha para g/planta", () => {
    expect(gramasPorPlanta(694, 4082)).toBeCloseTo(170, 0);
  });
  it("retorna null sem população", () => {
    expect(gramasPorPlanta(100, 0)).toBeNull();
  });
});
