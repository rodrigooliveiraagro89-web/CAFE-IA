import { describe, expect, it } from "vitest";
import {
  canonicalize,
  hashSnapshot,
  shortHash,
  type RecommendationSnapshot,
} from "./recommendationSnapshot";

function snap(over: Partial<RecommendationSnapshot> = {}): RecommendationSnapshot {
  return {
    plotId: "plot-1",
    soilAnalysisId: "soil-1",
    engine: "AGRYN — Boletim 100 (IAC)",
    version: "b100.2026-08",
    params: { vAlvo: 60, cobertura: "270010", fonteP: "map", fonteK: "kcl", sacas: 45, plantasPorHa: 4082 },
    npk: { n: 200, p2o5: 60, k2o: 80, s: 25 },
    calagemTHa: 1.4,
    programa: [{ id: "map", formula: "11-52-00", kgPorHectare: 115 }],
    custoHa: 3200,
    custoSaca: 71.1,
    ...over,
  };
}

describe("canonicalize", () => {
  it("ordena chaves para gerar a mesma string independentemente da ordem", () => {
    const a = canonicalize({ b: 1, a: { d: 4, c: 3 } });
    const b = canonicalize({ a: { c: 3, d: 4 }, b: 1 });
    expect(a).toBe(b);
  });

  it("preserva a ordem dos arrays", () => {
    expect(canonicalize([3, 1, 2])).toBe("[3,1,2]");
  });
});

describe("hashSnapshot", () => {
  it("é estável para conteúdos iguais", async () => {
    const h1 = await hashSnapshot(snap());
    const h2 = await hashSnapshot(snap());
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
  });

  it("muda quando qualquer dado muda", async () => {
    const base = await hashSnapshot(snap());
    const outra = await hashSnapshot(snap({ npk: { n: 250, p2o5: 60, k2o: 80, s: 31 } }));
    expect(outra).not.toBe(base);
  });

  it("shortHash devolve os 12 primeiros hex", async () => {
    const h = await hashSnapshot(snap());
    expect(shortHash(h)).toBe(h.slice(0, 12));
    expect(shortHash(h)).toHaveLength(12);
  });
});
