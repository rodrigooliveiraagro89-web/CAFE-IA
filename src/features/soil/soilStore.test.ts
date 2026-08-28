import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useSoilAnalyses } from "./soilStore";
import { pendingCount } from "../../lib/syncOutbox";

function setOnline(v: boolean) {
  Object.defineProperty(navigator, "onLine", { value: v, configurable: true });
}

const input = () => ({ plotId: "t1", analysisDate: "2026-08-01", laboratory: "LAB", source: "manual" as const, values: {} });

describe("useSoilAnalyses (integração store)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setOnline(true);
  });

  it("análise criada OFFLINE entra na outbox (escrita durável, não fica órfã)", async () => {
    setOnline(false);
    const { result } = renderHook(() => useSoilAnalyses("test-user-id"));
    await waitFor(() => expect(result.current.analyses).toHaveLength(0));
    act(() => { result.current.addAnalysis(input()); });
    expect(result.current.analyses).toHaveLength(1);
    expect(pendingCount()).toBe(1);
    const ops = JSON.parse(window.localStorage.getItem("agryn.outbox.v1") ?? "[]");
    expect(ops[0].table).toBe("soil_analyses");
    expect(ops[0].onConflict).toBe("id");
  });

  it("modo demo não grava nada (sem outbox)", () => {
    const { result } = renderHook(() => useSoilAnalyses("test-user-id", true));
    act(() => { result.current.addAnalysis(input()); });
    expect(pendingCount()).toBe(0);
  });
});
