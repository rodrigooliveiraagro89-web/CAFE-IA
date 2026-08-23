import { describe, expect, it } from "vitest";
import { normalizeBrPhone } from "./phone";

describe("normalizeBrPhone", () => {
  it("adiciona 55 a número com DDD e máscara", () => {
    expect(normalizeBrPhone("(35) 99999-8888")).toBe("5535999998888");
  });

  it("mantém quando já tem 55", () => {
    expect(normalizeBrPhone("5535999998888")).toBe("5535999998888");
  });

  it("aceita fixo de 10 dígitos", () => {
    expect(normalizeBrPhone("3533334444")).toBe("553533334444");
  });

  it("vazio devolve vazio", () => {
    expect(normalizeBrPhone("")).toBe("");
  });
});
