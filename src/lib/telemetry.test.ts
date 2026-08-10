import { describe, expect, it } from "vitest";
import { buildEventRow, eventSignature, sanitizePath } from "./telemetry";

describe("sanitizePath", () => {
  it("mantém só o caminho, sem query sensível", () => {
    expect(sanitizePath("https://app.exemplo.com/CAFE-IA/?token=abc123&email=x@y.com")).toBe("/CAFE-IA/");
  });

  it("preserva o parâmetro view (identifica a tela, não é dado pessoal)", () => {
    expect(sanitizePath("https://app.exemplo.com/CAFE-IA/?view=analise-solo&secret=1")).toBe(
      "/CAFE-IA/?view=analise-solo",
    );
  });

  it("devolve string vazia para URL inválida", () => {
    expect(sanitizePath("não é url")).toBe("");
  });
});

describe("buildEventRow", () => {
  it("monta a linha com path saneado e UA/mensagem truncados", () => {
    const row = buildEventRow(
      "error",
      "x".repeat(600),
      { line: 10 },
      { href: "https://a.com/CAFE-IA/?view=ndvi&q=segredo", userAgent: "u".repeat(400), appVersion: "abc123" },
    );
    expect(row.kind).toBe("error");
    expect(row.message).toHaveLength(500);
    expect(row.user_agent).toHaveLength(300);
    expect(row.path).toBe("/CAFE-IA/?view=ndvi");
    expect(row.app_version).toBe("abc123");
    expect(row.context).toEqual({ line: 10 });
  });
});

describe("eventSignature", () => {
  it("gera assinatura estável por tipo+mensagem", () => {
    expect(eventSignature("error", "boom")).toBe("error:boom");
  });

  it("limita o tamanho da assinatura", () => {
    expect(eventSignature("error", "z".repeat(300)).length).toBeLessThanOrEqual(160);
  });
});
