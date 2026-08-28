import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useCropPlans } from "./useCropPlan";
import { pendingCount } from "../../lib/syncOutbox";
import type { CropPlanItem } from "../../domain/cropPlan";

function setOnline(v: boolean) {
  Object.defineProperty(navigator, "onLine", { value: v, configurable: true });
}

const item = (id: string, over: Partial<CropPlanItem> = {}): CropPlanItem => ({
  id, kind: "adubacao", title: "t", month: 1, plannedCost: 0, quantity: "", unit: "",
  status: "planejada", notes: "", source: "manual", ...over,
});

const novo = (items: CropPlanItem[]) => ({ propertyId: "p", plotId: "t1", safra: "2026/27", title: "Plano", items });

describe("useCropPlans (integração store)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setOnline(true);
  });

  it("cria plano localmente sem userId", () => {
    const { result } = renderHook(() => useCropPlans(null));
    act(() => { result.current.addPlan(novo([item("a")])); });
    expect(result.current.plans).toHaveLength(1);
    expect(result.current.plans[0].items).toHaveLength(1);
  });

  it("patchItem reconcilia sobre o CURRENT: duas conclusões seguidas não se sobrescrevem", () => {
    const { result } = renderHook(() => useCropPlans(null));
    let planId = "";
    act(() => { planId = result.current.addPlan(novo([item("a"), item("b")])).id; });
    act(() => { result.current.patchItem(planId, "a", { status: "concluida" }); });
    act(() => { result.current.patchItem(planId, "b", { status: "concluida" }); });
    const plan = result.current.plans.find((p) => p.id === planId)!;
    expect(plan.items.every((i) => i.status === "concluida")).toBe(true);
  });

  it("addItem e removeItem operam por item", () => {
    const { result } = renderHook(() => useCropPlans(null));
    let planId = "";
    act(() => { planId = result.current.addPlan(novo([item("a")])).id; });
    act(() => { result.current.addItem(planId, item("b")); });
    expect(result.current.plans[0].items).toHaveLength(2);
    act(() => { result.current.removeItem(planId, "a"); });
    expect(result.current.plans[0].items.map((i) => i.id)).toEqual(["b"]);
  });

  it("removePlan (offline) enfileira exclusão durável que substitui o upsert pendente", async () => {
    setOnline(false); // mantém as ops na fila (sem flush)
    const { result } = renderHook(() => useCropPlans("test-user-id"));
    await waitFor(() => expect(result.current.plans).toHaveLength(0));
    let planId = "";
    act(() => { planId = result.current.addPlan(novo([])).id; });
    expect(pendingCount()).toBe(1); // upsert do plano criado offline
    act(() => { result.current.removePlan(planId); });
    expect(result.current.plans).toHaveLength(0);
    expect(pendingCount()).toBe(1); // delete substituiu o upsert (mesma chave de dedup)
    const ops = JSON.parse(window.localStorage.getItem("agryn.outbox.v1") ?? "[]");
    expect(ops[0].op).toBe("delete");
  });
});
