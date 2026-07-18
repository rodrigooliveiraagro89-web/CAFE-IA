import { describe, expect, it } from "vitest";
import { summarizeCosts, type FieldRecord } from "./fieldRecords";

function record(type: string, cost: number): FieldRecord {
  return {
    id: `${type}-${cost}`,
    propertyId: "p1",
    plotId: "t1",
    type,
    title: type,
    date: "2026-07-18",
    notes: "",
    status: "concluida",
    cost,
    quantity: "",
    unit: "",
    createdAt: "2026-07-18T12:00:00.000Z",
  };
}

describe("custos do caderno de campo", () => {
  it("soma apenas valores positivos informados pelo usuário", () => {
    const summary = summarizeCosts([
      record("Adubação", 350),
      record("Adubação", 150),
      record("Inspeção", 80),
      record("Observação", 0),
    ]);
    expect(summary.total).toBe(580);
    expect(summary.entries).toBe(3);
    expect(summary.byCategory).toEqual({ Adubação: 500, Inspeção: 80 });
  });
});
