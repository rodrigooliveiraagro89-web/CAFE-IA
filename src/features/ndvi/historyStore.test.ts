import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useNdviHistory } from "./historyStore";
import { pendingCount } from "../../lib/syncOutbox";
import type { NdviResult } from "./types";

function setOnline(v: boolean) {
  Object.defineProperty(navigator, "onLine", { value: v, configurable: true });
}

const result = (id: string): NdviResult =>
  ({ id, plotId: "t1", acquiredAt: "2026-08-01", processedAt: "2026-08-02", statistics: { mean: 0.6 } } as NdviResult);

describe("useNdviHistory (integração store)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setOnline(true);
  });

  it("resultado NDVI criado OFFLINE entra na outbox (escrita durável)", async () => {
    setOnline(false);
    const { result: hook } = renderHook(() => useNdviHistory("test-user-id"));
    await waitFor(() => expect(hook.current.history).toHaveLength(0));
    act(() => { hook.current.addResult(result("n1")); });
    expect(hook.current.history).toHaveLength(1);
    expect(pendingCount()).toBe(1);
    const ops = JSON.parse(window.localStorage.getItem("agryn.outbox.v1") ?? "[]");
    expect(ops[0].table).toBe("ndvi_results");
  });

  it("adicionar o mesmo id não duplica no histórico local", async () => {
    const { result: hook } = renderHook(() => useNdviHistory(null));
    act(() => { hook.current.addResult(result("n1")); });
    act(() => { hook.current.addResult(result("n1")); });
    expect(hook.current.history).toHaveLength(1);
  });
});
