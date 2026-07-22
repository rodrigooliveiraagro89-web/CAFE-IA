import { describe, expect, it } from "vitest";
import { buildManagementZones, zonesDiagnosis } from "./managementZones";
import type { NdviClass, NdviResult, NdviStatistics } from "./types";

function makeClass(id: string, percentage: number, hectares: number): NdviClass {
  return { id, label: id, color: "#000", min: 0, max: 1, pixelCount: 0, percentage, hectares };
}

function makeResult(
  generalClasses: NdviClass[] | undefined,
  statistics: Partial<NdviStatistics> = {},
  classes: NdviClass[] = [],
): NdviResult {
  return {
    id: "r1",
    sceneId: "s1",
    plotId: "p1",
    source: "sentinel-2-l2a",
    sensor: "S2",
    acquiredAt: "2026-07-01T00:00:00Z",
    processedAt: "2026-07-01T00:00:00Z",
    resolutionMeters: 10,
    totalAreaHectares: 10,
    validAreaHectares: 10,
    discardedAreaHectares: 0,
    validCoveragePercentage: 100,
    minimumValidCoveragePercentage: 70,
    statistics: {
      mean: 0.5,
      minimum: 0.1,
      maximum: 0.9,
      median: 0.5,
      standardDeviation: 0.1,
      ...statistics,
    },
    classes,
    generalClasses,
    attentionZones: [],
    provenance: {
      catalogUrl: "",
      collection: "sentinel-2-l2a",
      processorVersion: "1",
      maskMethod: "scl",
    },
  };
}

describe("zonas de manejo", () => {
  it("agrupa alto + muito-alto na zona A somando % e hectares", () => {
    const result = makeResult([
      makeClass("alto", 20, 2),
      makeClass("muito-alto", 15, 1.5),
      makeClass("intermediario", 30, 3),
      makeClass("baixo", 20, 2),
      makeClass("muito-baixo", 10, 1),
      makeClass("solo-exposto", 5, 0.5),
    ]);
    const zones = buildManagementZones(result);
    const zoneA = zones.find((zone) => zone.letter === "A");
    expect(zoneA?.percentage).toBe(35);
    expect(zoneA?.hectares).toBe(3.5);
  });

  it("devolve sempre as 5 zonas A–E na ordem", () => {
    const zones = buildManagementZones(makeResult([]));
    expect(zones.map((zone) => zone.letter)).toEqual(["A", "B", "C", "D", "E"]);
    expect(zones.every((zone) => zone.percentage === 0)).toBe(true);
  });

  it("usa classes como fallback quando generalClasses está ausente", () => {
    const result = makeResult(undefined, {}, [makeClass("intermediario", 40, 4)]);
    const zones = buildManagementZones(result);
    expect(zones.find((zone) => zone.letter === "B")?.percentage).toBe(40);
  });

  it("diagnóstico aponta variabilidade alta e zona dominante", () => {
    const result = makeResult(
      [
        makeClass("baixo", 60, 6),
        makeClass("muito-baixo", 20, 2),
        makeClass("solo-exposto", 20, 2),
      ],
      { coefficientOfVariation: 0.4 },
    );
    const text = zonesDiagnosis(result);
    expect(text).toContain("Variabilidade alta");
    expect(text).toContain("zona predominante é C");
    expect(text).toContain("atenção");
  });

  it("diagnóstico aponta homogeneidade quando CV é baixo", () => {
    const result = makeResult([makeClass("intermediario", 100, 10)], {
      coefficientOfVariation: 0.05,
    });
    expect(zonesDiagnosis(result)).toContain("homogêneo");
  });
});
