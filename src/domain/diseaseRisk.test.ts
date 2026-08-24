import { describe, expect, it } from "vitest";
import { diseaseRiskCafe, diseaseRiskBatata, diseaseRiskForCrop } from "./diseaseRisk";
import type { HourItem } from "./weather";

function h(temp: number, humidity: number, over = 1): HourItem[] {
  return Array.from({ length: over }, (_, i) => ({
    time: `2026-08-24T${String(i % 24).padStart(2, "0")}:00`,
    dayLabel: "seg 24/08",
    hourLabel: `${i}h`,
    temp,
    humidity,
    precipitation: 0,
    precipitationProbability: 0,
    wind: 5,
    code: 3,
    icon: "☁️",
  }));
}

describe("diseaseRiskCafe", () => {
  it("ferrugem ALTA com muitas horas úmidas e amenas", () => {
    const r = diseaseRiskCafe(h(23, 92, 10)).find((x) => x.id === "cafe-ferrugem");
    expect(r?.nivel).toBe("alto");
  });
  it("ferrugem BAIXA em tempo seco", () => {
    const r = diseaseRiskCafe(h(23, 50, 10)).find((x) => x.id === "cafe-ferrugem");
    expect(r?.nivel).toBe("baixo");
  });
  it("nunca afirma presença da doença", () => {
    const r = diseaseRiskCafe(h(23, 92, 10));
    for (const risco of r) expect(risco.resumo.toLowerCase()).not.toContain("está presente");
  });
});

describe("diseaseRiskBatata", () => {
  it("requeima ALTA com molhamento prolongado e ameno", () => {
    const r = diseaseRiskBatata(h(15, 95, 14)).find((x) => x.id === "batata-requeima");
    expect(r?.nivel).toBe("alto");
  });
});

describe("diseaseRiskForCrop", () => {
  it("batata → doenças de batata", () => {
    const r = diseaseRiskForCrop("Batata", h(15, 95, 12));
    expect(r.every((x) => x.cultura === "batata")).toBe(true);
  });
  it("café (default) → doenças de café", () => {
    const r = diseaseRiskForCrop("Café arábica", h(23, 92, 8));
    expect(r.every((x) => x.cultura === "cafe")).toBe(true);
  });
});
