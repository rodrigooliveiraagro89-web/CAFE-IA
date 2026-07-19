import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useAuth } from "./useAuth";

describe("useAuth", () => {
  it("resolve a sessão e o perfil da conta autenticada", async () => {
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.userId).toBe("test-user-id");
    await waitFor(() =>
      expect(result.current.profile).toEqual({
        nome: "Rodrigo Teste",
        tipo: "consultor",
        plano: "gratis",
        trialAte: null,
      }),
    );
  });

  it("signOut não lança erro", async () => {
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await expect(result.current.signOut()).resolves.toBeUndefined();
  });
});
