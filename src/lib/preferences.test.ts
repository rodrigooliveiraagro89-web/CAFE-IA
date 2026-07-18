import { describe, expect, it, vi } from "vitest";
import { loadPreferences, savePreferences } from "./preferences";

describe("preferências seguras", () => {
  it("ignora campos sensíveis encontrados no armazenamento", () => {
    const storage = {
      getItem: vi.fn(() => JSON.stringify({ theme: "dark", lastView: "inicio", apiKey: "segredo" })),
    };
    expect(loadPreferences(storage)).toEqual({ theme: "dark", lastView: "inicio" });
  });

  it("persiste apenas tema e última tela", () => {
    const setItem = vi.fn();
    savePreferences({ theme: "light", lastView: "seguranca" }, { setItem });
    const payload = setItem.mock.calls[0]?.[1] as string;
    expect(payload).toBe('{"theme":"light","lastView":"seguranca"}');
    expect(payload).not.toContain("key");
  });
});
