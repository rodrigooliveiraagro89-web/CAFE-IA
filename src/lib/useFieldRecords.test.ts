import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useFieldRecords } from "./useFieldRecords";

const STORAGE_KEY = "agryn.field-records.v1";

describe("useFieldRecords", () => {
  beforeEach(() => window.localStorage.clear());

  it("funciona só localmente sem userId", () => {
    const { result } = renderHook(() => useFieldRecords(null));
    act(() => {
      result.current.addRecord("property-1", "plot-1", {
        type: "Inspeção",
        title: "Visita técnica",
        date: "2026-07-19",
        notes: "",
        status: "planejada",
        cost: 0,
        quantity: "",
        unit: "",
      });
    });
    expect(result.current.records).toHaveLength(1);
  });

  it("busca os registros da conta quando há userId, substituindo o cache local", async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: "local-1" }]));
    const { result } = renderHook(() => useFieldRecords("test-user-id"));
    await waitFor(() => expect(result.current.records).toHaveLength(0));
  });

  it("limpa o cache local ao deslogar", async () => {
    const initialProps: { userId: string | null } = { userId: "test-user-id" };
    const { result, rerender } = renderHook(
      ({ userId }) => useFieldRecords(userId),
      { initialProps },
    );
    await waitFor(() => expect(result.current.records).toHaveLength(0));

    rerender({ userId: null });

    await waitFor(() => expect(result.current.records).toHaveLength(0));
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toHaveLength(0);
  });
});
