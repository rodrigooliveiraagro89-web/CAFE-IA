import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useAgriculturalContext } from "./useAgriculturalContext";

const STORAGE_KEY = "agryn.agricultural-context.v1";

describe("useAgriculturalContext", () => {
  beforeEach(() => window.localStorage.clear());

  it("funciona só localmente sem userId (compatível com telas sem sessão e testes)", () => {
    const { result } = renderHook(() => useAgriculturalContext(null));
    act(() => {
      result.current.addProperty({
        name: "Fazenda Teste",
        producer: "Produtor",
        responsible: "Responsável",
        city: "Machado",
        state: "MG",
      });
    });
    expect(result.current.state.properties).toHaveLength(1);
    expect(result.current.selectedProperty?.name).toBe("Fazenda Teste");
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!).properties).toHaveLength(1);
  });

  it("a nuvem prevalece sobre um cache local antigo assim que há userId", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        properties: [
          {
            id: "local-1",
            name: "Local antigo",
            producer: "",
            responsible: "",
            city: "",
            state: "",
            createdAt: "",
          },
        ],
        plots: [],
        selectedPropertyId: "local-1",
        selectedPlotId: "",
      }),
    );

    const { result } = renderHook(() => useAgriculturalContext("test-user-id"));
    await waitFor(() => expect(result.current.state.properties).toHaveLength(0));
  });

  it("limpa o cache local ao deslogar", async () => {
    const initialProps: { userId: string | null } = { userId: "test-user-id" };
    const { result, rerender } = renderHook(
      ({ userId }) => useAgriculturalContext(userId),
      { initialProps },
    );
    await waitFor(() => expect(result.current.state.properties).toHaveLength(0));

    rerender({ userId: null });

    await waitFor(() => expect(result.current.state.properties).toHaveLength(0));
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!).properties).toHaveLength(0);
  });
});
