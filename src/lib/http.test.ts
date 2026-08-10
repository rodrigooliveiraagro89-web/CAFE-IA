import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithTimeout, TimeoutError } from "./http";

describe("fetchWithTimeout", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("devolve a resposta quando responde a tempo", async () => {
    const res = new Response("ok");
    vi.stubGlobal("fetch", () => Promise.resolve(res));
    await expect(fetchWithTimeout("http://x", {}, 1000)).resolves.toBe(res);
  });

  it("lança TimeoutError quando estoura o tempo", async () => {
    // fetch que só rejeita quando o signal é abortado (simula conexão pendurada).
    vi.stubGlobal(
      "fetch",
      (_input: RequestInfo | URL, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );
    await expect(fetchWithTimeout("http://x", {}, 10)).rejects.toBeInstanceOf(TimeoutError);
  });

  it("propaga erro de rede que não é timeout", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new TypeError("Failed to fetch")));
    await expect(fetchWithTimeout("http://x", {}, 1000)).rejects.toBeInstanceOf(TypeError);
  });
});
