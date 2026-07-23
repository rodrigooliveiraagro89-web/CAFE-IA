import { describe, expect, it } from "vitest";
import { interpretSoil, soilAlerts, type SoilValues } from "./soilAnalysis";

function rowFor(values: SoilValues, key: string) {
  return interpretSoil(values).find((row) => row.key === key);
}

describe("interpretação de solo", () => {
  it("classifica cada faixa nos limites", () => {
    expect(rowFor({ ph: 5.0 }, "ph")?.level).toBe("baixo");
    expect(rowFor({ ph: 6.0 }, "ph")?.level).toBe("adequado");
    expect(rowFor({ ph: 7.0 }, "ph")?.level).toBe("alto");
    expect(rowFor({ vPercent: 45 }, "vPercent")?.level).toBe("baixo");
    expect(rowFor({ vPercent: 64 }, "vPercent")?.level).toBe("adequado");
  });

  it("trata CTC/Fe/Mn como informativos (sem nível de risco)", () => {
    expect(rowFor({ ctc: 8.5 }, "ctc")?.level).toBe("informativo");
    expect(rowFor({ fe: 12.4 }, "fe")?.level).toBe("informativo");
  });

  it("ignora valores ausentes ou não numéricos", () => {
    const rows = interpretSoil({ ph: null, p: undefined, k: 60 });
    expect(rows.map((row) => row.key)).toEqual(["k"]);
  });

  it("não gera alerta falso quando o valor está ausente", () => {
    expect(soilAlerts(interpretSoil({}))).toEqual([]);
  });

  it("gera alertas para Zn/B baixos e m% alto", () => {
    const rows = interpretSoil({ zn: 0.5, b: 0.2, mPercent: 40, ca: 3 });
    const alerts = soilAlerts(rows);
    expect(alerts.some((a) => a.includes("Zinco"))).toBe(true);
    expect(alerts.some((a) => a.includes("Boro"))).toBe(true);
    expect(alerts.some((a) => a.includes("alumínio"))).toBe(true);
    // Ca adequado não gera alerta
    expect(alerts.some((a) => a.includes("Cálcio"))).toBe(false);
  });

  it("não alerta quando m% é baixo (lado seguro)", () => {
    expect(soilAlerts(interpretSoil({ mPercent: 2 }))).toEqual([]);
  });
});
