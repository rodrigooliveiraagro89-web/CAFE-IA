import { describe, expect, it } from "vitest";
import {
  canAddPlot,
  canAddProperty,
  effectivePlanId,
  plans,
  resolvePlan,
  trialAlreadyUsed,
} from "./plans";

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

  it("teste vigente eleva o plano efetivo para pro; expirado volta pro grátis", () => {
    const now = new Date("2026-07-19T12:00:00Z");
    const futuro = "2026-08-01T12:00:00Z";
    const passado = "2026-07-01T12:00:00Z";
    expect(effectivePlanId("gratis", futuro, now)).toBe("pro");
    expect(effectivePlanId("gratis", passado, now)).toBe("gratis");
    expect(effectivePlanId("gratis", null, now)).toBe("gratis");
    expect(effectivePlanId("gratis", "data-invalida", now)).toBe("gratis");
    expect(effectivePlanId("pro", null, now)).toBe("pro");
  });

  it("teste só pode ser ativado uma vez", () => {
    expect(trialAlreadyUsed(null)).toBe(false);
    expect(trialAlreadyUsed(undefined)).toBe(false);
    expect(trialAlreadyUsed("2026-07-01T12:00:00Z")).toBe(true);
  });
});
