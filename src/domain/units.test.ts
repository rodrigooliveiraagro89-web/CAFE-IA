import { describe, expect, it } from "vitest";
import {
  areaInUnit,
  distanceInUnit,
  formatArea,
  formatDistance,
} from "./units";

describe("units — área", () => {
  it("converte hectares para m²", () => {
    expect(areaInUnit(1, "m2")).toBe(10_000);
    expect(areaInUnit(3.2, "m2")).toBeCloseTo(32_000, 5);
  });

  it("converte para alqueire paulista (2,42 ha) e mineiro (4,84 ha)", () => {
    expect(areaInUnit(2.42, "alq_paulista")).toBeCloseTo(1, 6);
    expect(areaInUnit(4.84, "alq_mineiro")).toBeCloseTo(1, 6);
  });

  it("converte para acre", () => {
    expect(areaInUnit(1, "acre")).toBeCloseTo(2.471054, 4);
  });

  it("formata em pt-BR com a unidade curta", () => {
    expect(formatArea(3.42, "ha")).toBe("3,42 ha");
    expect(formatArea(1, "m2")).toBe("10.000 m²");
  });
});

describe("units — distância", () => {
  it("converte metros para km", () => {
    expect(distanceInUnit(1500, "km")).toBe(1.5);
    expect(distanceInUnit(1500, "m")).toBe(1500);
  });

  it("formata com casas por unidade", () => {
    expect(formatDistance(812.4, "m")).toBe("812 m");
    expect(formatDistance(1250, "km")).toBe("1,25 km");
  });
});
