import { describe, expect, it } from "vitest";
import type { ManagementZone } from "../features/ndvi/managementZones";
import { construirPrescricaoVR, prescricaoParaCsv } from "./variableRate";

function zona(
  letter: ManagementZone["letter"],
  hectares: number,
  percentage: number,
): ManagementZone {
  return {
    letter,
    label: letter,
    ndviMin: 0,
    ndviMax: 1,
    percentage,
    hectares,
    color: "#000",
    guidance: "",
  };
}

const DOSE_BASE = { n: 200, p2o5: 60, k2o: 200 };

describe("construirPrescricaoVR", () => {
  it("modula a dose por zona: menos vigor recebe mais, vigor alto recebe menos", () => {
    const zonas = [zona("A", 1, 25), zona("B", 1, 25), zona("C", 1, 25), zona("D", 1, 25)];
    const prescricao = construirPrescricaoVR(zonas, DOSE_BASE);

    const [a, b, c, d] = prescricao.zonas;
    expect(a.dosePorHectare.n).toBeCloseTo(180, 6); // 200 x 0,9
    expect(b.dosePorHectare.n).toBeCloseTo(200, 6); // 200 x 1,0
    expect(c.dosePorHectare.n).toBeCloseTo(230, 6); // 200 x 1,15
    expect(d.dosePorHectare.n).toBeCloseTo(250, 6); // 200 x 1,25

    // A ordem faz sentido agronômico: dose cresce conforme o vigor cai
    expect(a.dosePorHectare.n).toBeLessThan(b.dosePorHectare.n);
    expect(c.dosePorHectare.n).toBeLessThan(d.dosePorHectare.n);
  });

  it("exclui a zona E da adubação até a causa ser investigada", () => {
    const prescricao = construirPrescricaoVR([zona("E", 2, 100)], DOSE_BASE);
    const e = prescricao.zonas[0];

    expect(e.excluida).toBe(true);
    expect(e.dosePorHectare.n).toBe(0);
    expect(e.totalZona.n).toBe(0);
    expect(prescricao.hectaresAdubados).toBe(0);
    expect(prescricao.hectaresTotais).toBe(2);
  });

  it("multiplica a dose pela área de cada zona para o total", () => {
    const prescricao = construirPrescricaoVR([zona("B", 10, 100)], DOSE_BASE);

    // fator 1,0 -> 200 kg/ha x 10 ha = 2000 kg de N
    expect(prescricao.totalVariavel.n).toBeCloseTo(2000, 6);
    expect(prescricao.totalVariavel.k2o).toBeCloseTo(2000, 6);
    expect(prescricao.totalVariavel.p2o5).toBeCloseTo(600, 6);
  });

  it("mostra economia quando há zona excluída ou muita zona de vigor alto", () => {
    // 5 ha de zona A (0,9) + 5 ha de zona E (0) = bem menos que uniforme
    const prescricao = construirPrescricaoVR([zona("A", 5, 50), zona("E", 5, 50)], DOSE_BASE);

    expect(prescricao.totalUniforme.n).toBeCloseTo(2000, 6); // 200 x 10 ha
    expect(prescricao.totalVariavel.n).toBeCloseTo(900, 6); // 180 x 5
    expect(prescricao.economia.n).toBeCloseTo(1100, 6);
  });

  it("pode consumir mais que o uniforme quando predominam zonas fracas", () => {
    const prescricao = construirPrescricaoVR([zona("D", 10, 100)], DOSE_BASE);

    // 250 x 10 = 2500 contra 2000 uniforme -> economia negativa
    expect(prescricao.economia.n).toBeCloseTo(-500, 6);
  });

  it("trata lista de zonas vazia sem quebrar", () => {
    const prescricao = construirPrescricaoVR([], DOSE_BASE);

    expect(prescricao.totalVariavel.n).toBe(0);
    expect(prescricao.hectaresTotais).toBe(0);
    expect(prescricao.zonas).toHaveLength(0);
  });
});

describe("prescricaoParaCsv", () => {
  it("gera cabeçalho e uma linha por zona", () => {
    const prescricao = construirPrescricaoVR([zona("A", 2, 40), zona("B", 3, 60)], DOSE_BASE);
    const csv = prescricaoParaCsv(prescricao);
    const linhas = csv.split("\n");

    expect(linhas).toHaveLength(3); // cabeçalho + 2 zonas
    expect(linhas[0]).toContain("zona,classe,area_ha");
    expect(linhas[1].startsWith("A,")).toBe(true);
    expect(linhas[2].startsWith("B,")).toBe(true);
  });

  it("usa ponto decimal para o controlador da adubadora", () => {
    const csv = prescricaoParaCsv(construirPrescricaoVR([zona("C", 1.5, 100)], DOSE_BASE));

    expect(csv).toContain("1.50");
    // 200 x 1,15 = 230
    expect(csv).toContain("230.0");
  });
});
