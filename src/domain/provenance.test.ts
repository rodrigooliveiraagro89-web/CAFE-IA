import { describe, expect, it } from "vitest";
import { ENGINE_VERSAO, buildProveniencia, provenienciaResumo } from "./provenance";

const PARAMS = { vAlvo: 60, cobertura: "27-00-10", fonteP: "map", fonteK: "kcl", sacas: 45, plantasPorHa: 4082 };

describe("buildProveniencia", () => {
  it("carimba engine, versão e data", () => {
    const p = buildProveniencia(null, PARAMS, "2026-08-11T10:00:00Z");
    expect(p.versao).toBe(ENGINE_VERSAO);
    expect(p.geradoEm).toBe("2026-08-11T10:00:00Z");
    expect(p.laudo).toBeNull();
  });
});

describe("provenienciaResumo", () => {
  it("descreve o laudo, a base e os parâmetros", () => {
    const p = buildProveniencia(
      { id: "l1", data: "2026-06-19", laboratorio: "Profert", origem: "pdf" },
      PARAMS,
      "2026-08-11T10:00:00Z",
    );
    const texto = provenienciaResumo(p);
    expect(texto).toContain("Profert");
    expect(texto).toContain("19/06/2026");
    expect(texto).toContain("PDF do laudo");
    expect(texto).toContain("27-00-10");
    expect(texto).toContain("45 sc/ha");
  });

  it("sinaliza quando não há laudo", () => {
    const texto = provenienciaResumo(buildProveniencia(null, PARAMS, "2026-08-11T10:00:00Z"));
    expect(texto).toContain("sem laudo");
  });
});
