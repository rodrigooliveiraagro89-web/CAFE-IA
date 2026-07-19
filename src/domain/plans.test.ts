import { describe, expect, it } from "vitest";
import { canAddPlot, canAddProperty, plans, resolvePlan } from "./plans";

describe("planos comerciais", () => {
  it("plano grátis limita 1 propriedade e 2 talhões por propriedade", () => {
    expect(canAddProperty(plans.gratis, 0)).toBe(true);
    expect(canAddProperty(plans.gratis, 1)).toBe(false);
    expect(canAddPlot(plans.gratis, 1)).toBe(true);
    expect(canAddPlot(plans.gratis, 2)).toBe(false);
  });

  it("plano pro não impõe limites", () => {
    expect(canAddProperty(plans.pro, 500)).toBe(true);
    expect(canAddPlot(plans.pro, 500)).toBe(true);
  });

  it("resolve plano desconhecido ou ausente como grátis", () => {
    expect(resolvePlan(null).id).toBe("gratis");
    expect(resolvePlan(undefined).id).toBe("gratis");
    expect(resolvePlan("qualquer-coisa").id).toBe("gratis");
    expect(resolvePlan("pro").id).toBe("pro");
  });
});
