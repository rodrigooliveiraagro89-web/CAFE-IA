import { describe, expect, it } from "vitest";
import { formatNumberBR, parseNumberBR, parsePositiveBR } from "./parseNumber";

describe("parseNumberBR", () => {
  it("aceita vírgula decimal brasileira", () => {
    expect(parseNumberBR("3,5")).toBe(3.5);
  });

  it("aceita ponto decimal", () => {
    expect(parseNumberBR("3.5")).toBe(3.5);
  });

  it("entende milhar BR com decimal (1.234,56)", () => {
    expect(parseNumberBR("1.234,56")).toBe(1234.56);
  });

  it("ignora espaços internos", () => {
    expect(parseNumberBR(" 1 234,5 ")).toBe(1234.5);
  });

  it("devolve null para vazio — nunca 0 silencioso", () => {
    expect(parseNumberBR("")).toBeNull();
    expect(parseNumberBR("   ")).toBeNull();
    expect(parseNumberBR(null)).toBeNull();
    expect(parseNumberBR(undefined)).toBeNull();
  });

  it("devolve null para texto inválido", () => {
    expect(parseNumberBR("abc")).toBeNull();
    expect(parseNumberBR("3,5,7")).toBeNull();
  });

  it("aceita zero e negativos como números válidos", () => {
    expect(parseNumberBR("0")).toBe(0);
    expect(parseNumberBR("-2,5")).toBe(-2.5);
  });

  it("passa número finito adiante e barra NaN/Infinity", () => {
    expect(parseNumberBR(42)).toBe(42);
    expect(parseNumberBR(Number.NaN)).toBeNull();
    expect(parseNumberBR(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("parsePositiveBR", () => {
  it("exige valor estritamente positivo", () => {
    expect(parsePositiveBR("3,5")).toBe(3.5);
    expect(parsePositiveBR("0")).toBeNull();
    expect(parsePositiveBR("-1")).toBeNull();
    expect(parsePositiveBR("")).toBeNull();
  });
});

describe("formatNumberBR", () => {
  it("formata com vírgula decimal", () => {
    expect(formatNumberBR(1234.5)).toBe("1.234,50");
    expect(formatNumberBR(3.5, 1)).toBe("3,5");
  });
});
