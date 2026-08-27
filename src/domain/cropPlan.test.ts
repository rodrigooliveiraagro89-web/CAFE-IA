import { describe, expect, it } from "vitest";
import {
  generatePlanItems,
  mesFromEpoca,
  sortPlanItems,
  summarizePlan,
  type CropPlan,
  type CropPlanItem,
} from "./cropPlan";
import type { ParcelaAdubacao } from "../agronomy/types";

let seq = 0;
const idFactory = () => `id-${++seq}`;

const CAL = [
  { id: "analise-solo", label: "Análise de solo", kind: "analise", months: [4, 5, 6, 7] },
  { id: "calagem", label: "Calagem / Gessagem", kind: "calagem", months: [3, 4, 7, 8, 9] },
  { id: "adubacao-solo", label: "Adubação via solo", kind: "adubacao", months: [1, 2, 9, 10, 11, 12] },
  { id: "adubacao-foliar", label: "Adubação foliar", kind: "foliar", months: [1, 2, 3, 9, 10, 11, 12] },
  { id: "colheita", label: "Colheita", kind: "colheita", months: [4, 5, 6, 7, 8] },
];

const CRONO: ParcelaAdubacao[] = [
  { ordem: 1, epoca: "Outubro", N_kg_ha: 60, P2O5_kg_ha: 80, K2O_kg_ha: 50, S_kg_ha: 10 },
  { ordem: 2, epoca: "Dezembro", N_kg_ha: 60, P2O5_kg_ha: 0, K2O_kg_ha: 50, S_kg_ha: 10 },
];

describe("mesFromEpoca", () => {
  it("extrai o mês do primeiro token da época", () => {
    expect(mesFromEpoca("Outubro")).toBe(10);
    expect(mesFromEpoca("Janeiro/Fevereiro")).toBe(1);
    expect(mesFromEpoca("Março")).toBe(3);
    expect(mesFromEpoca("desconhecido")).toBe(1);
  });
});

describe("generatePlanItems", () => {
  it("sem cronograma, gera um item por atividade do calendário (no mês mais cedo)", () => {
    seq = 0;
    const itens = generatePlanItems({ calendar: CAL, idFactory });
    // 5 atividades do calendário, incluindo a adubação genérica (solo e foliar)
    expect(itens).toHaveLength(5);
    const analise = itens.find((i) => i.kind === "analise");
    expect(analise?.month).toBe(4);
    expect(itens.some((i) => i.kind === "adubacao" && i.source === "calendario")).toBe(true);
    // ordenado por mês
    expect(itens.map((i) => i.month)).toEqual([...itens.map((i) => i.month)].sort((a, b) => a - b));
  });

  it("com cronograma, troca só a adubação de SOLO pelas parcelas (foliar permanece)", () => {
    seq = 0;
    const itens = generatePlanItems({ calendar: CAL, cronograma: CRONO, idFactory });
    // adubação de solo genérica some; entram 2 parcelas da 5ª
    expect(itens.filter((i) => i.source === "calendario" && i.kind === "adubacao")).toHaveLength(0);
    const parcelas = itens.filter((i) => i.source === "adubacao5a");
    expect(parcelas).toHaveLength(2);
    expect(parcelas[0].quantity).toContain("N 60");
    expect(parcelas.find((p) => p.title.includes("Outubro"))?.month).toBe(10);
    // Regressão: "Adubação foliar" (kind foliar) NÃO é coberta pelas parcelas de
    // solo e deve permanecer no plano mesmo havendo cronograma.
    expect(itens.some((i) => i.kind === "foliar" && i.source === "calendario")).toBe(true);
  });
});

describe("summarizePlan", () => {
  function item(over: Partial<CropPlanItem>): CropPlanItem {
    return {
      id: over.id ?? "x",
      kind: "adubacao",
      title: "t",
      month: 1,
      plannedCost: 0,
      quantity: "",
      unit: "",
      status: "planejada",
      notes: "",
      source: "manual",
      ...over,
    };
  }
  const plan = (items: CropPlanItem[]): Pick<CropPlan, "items"> => ({ items });

  it("soma previsto e realizado; realizado vem do registro vinculado", () => {
    const s = summarizePlan(
      plan([
        item({ id: "a", plannedCost: 100, status: "concluida", fieldRecordId: "r1" }),
        item({ id: "b", plannedCost: 200, status: "planejada" }),
        item({ id: "c", plannedCost: 50, status: "cancelada" }),
      ]),
      [{ id: "r1", cost: 130 }],
    );
    expect(s.plannedTotal).toBe(300); // 100 + 200 (cancelada não conta)
    expect(s.realizedTotal).toBe(130); // do registro, não do previsto
    expect(s.doneCount).toBe(1);
    expect(s.plannedCount).toBe(1);
    expect(s.canceledCount).toBe(1);
    expect(s.activeCount).toBe(2);
    expect(s.adherencePct).toBe(50);
  });

  it("usa realizedCost quando o registro não existe mais", () => {
    const s = summarizePlan(
      plan([item({ id: "a", plannedCost: 100, status: "concluida", fieldRecordId: "sumiu", realizedCost: 90 })]),
      [],
    );
    expect(s.realizedTotal).toBe(90);
    expect(s.adherencePct).toBe(100);
  });

  it("plano vazio não divide por zero", () => {
    expect(summarizePlan(plan([]), []).adherencePct).toBe(0);
  });
});

describe("sortPlanItems", () => {
  it("estável dentro do mesmo mês", () => {
    const base = { kind: "x", title: "", plannedCost: 0, quantity: "", unit: "", status: "planejada" as const, notes: "", source: "manual" as const };
    const out = sortPlanItems([
      { ...base, id: "a", month: 5 },
      { ...base, id: "b", month: 1 },
      { ...base, id: "c", month: 1 },
    ]);
    expect(out.map((i) => i.id)).toEqual(["b", "c", "a"]);
  });
});
