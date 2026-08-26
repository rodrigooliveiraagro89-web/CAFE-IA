import { describe, expect, it } from "vitest";
import {
  CALENDAR,
  calendarSummary,
  coreAlerts,
  pushAlerts,
  upcomingActivityAlerts,
  type AlertInput,
} from "./alertRules";

const HOJE = "2026-08-03";

function input(over: Partial<AlertInput> = {}): AlertInput {
  return { plots: [], records: [], ndvi: [], soil: [], ...over };
}

describe("coreAlerts — o que o app e o push compartilham", () => {
  it("atividade planejada vencida vira alerta alta", () => {
    const a = coreAlerts(
      input({ records: [{ id: "r1", status: "planejada", date: "2026-07-01" }] }),
      HOJE,
    );
    expect(a.find((x) => x.key === "atividades-atrasadas")?.severity).toBe("alta");
  });

  it("NDVI em queda entre as duas últimas cenas", () => {
    const a = coreAlerts(
      input({
        plots: [{ id: "t1", name: "Talhão 1" }],
        ndvi: [
          { plotId: "t1", acquiredAt: "2026-08-01", mean: 0.5 },
          { plotId: "t1", acquiredAt: "2026-07-01", mean: 0.62 },
        ],
        soil: [{ plotId: "t1", date: "2026-07-15" }],
      }),
      HOJE,
    );
    const q = a.find((x) => x.key === "ndvi-queda-t1");
    expect(q?.severity).toBe("alta");
    expect(q?.body).toContain("0.62");
  });

  it("NDVI ausente é info; laudo recente não gera alerta de solo", () => {
    const a = coreAlerts(input({ plots: [{ id: "t1", name: "T1" }], soil: [{ plotId: "t1", date: "2026-07-15" }] }), HOJE);
    expect(a.find((x) => x.key === "ndvi-ausente-t1")?.severity).toBe("info");
    expect(a.find((x) => x.key?.startsWith("solo-"))).toBeUndefined();
  });

  it("laudo com mais de 365 dias vence (limiar unificado com o push)", () => {
    const vencido = coreAlerts(
      input({ plots: [{ id: "t1", name: "T1" }], soil: [{ plotId: "t1", date: "2025-08-01" }] }),
      HOJE,
    );
    expect(vencido.find((x) => x.key === "solo-vencido-t1")).toBeDefined();

    // 360 dias: já vencia no limiar antigo do app (360), mas NÃO no unificado (365).
    const naoVence = coreAlerts(
      input({ plots: [{ id: "t2", name: "T2" }], soil: [{ plotId: "t2", date: "2025-08-08" }] }),
      HOJE,
    );
    expect(naoVence.find((x) => x.key === "solo-vencido-t2")).toBeUndefined();
  });

  it("não inclui calendário nem atividades próximas (isso é só do push)", () => {
    const a = coreAlerts(
      input({ records: [{ id: "r1", status: "planejada", date: HOJE }] }),
      HOJE,
    );
    expect(a.find((x) => x.key.startsWith("calendario-"))).toBeUndefined();
    expect(a.find((x) => x.key.startsWith("atividade-proxima-"))).toBeUndefined();
  });
});

describe("upcomingActivityAlerts — atividades chegando", () => {
  it("avisa a planejada dentro da janela e ignora as distantes", () => {
    const a = upcomingActivityAlerts(
      input({
        plots: [{ id: "t1", name: "Talhão 1" }],
        records: [
          { id: "r1", status: "planejada", date: "2026-08-04", plotId: "t1", title: "Adubação" }, // amanhã
          { id: "r2", status: "planejada", date: "2026-09-01", plotId: "t1", title: "Poda" }, // longe
        ],
      }),
      HOJE,
    );
    expect(a.map((x) => x.key)).toContain("atividade-proxima-r1");
    expect(a.map((x) => x.key)).not.toContain("atividade-proxima-r2");
    expect(a[0].body).toContain("Talhão 1");
  });
});

describe("calendarSummary + pushAlerts", () => {
  it("resume o mês e o push inclui calendário + próximas + core", () => {
    const cal = calendarSummary(HOJE);
    expect(cal?.key).toBe("calendario-2026-08");
    expect(cal?.view).toBe("clima");

    const a = pushAlerts(
      input({
        plots: [{ id: "t1", name: "T1" }],
        records: [
          { id: "r1", status: "planejada", date: "2026-07-01" }, // atrasada
          { id: "r2", status: "planejada", date: "2026-08-05", plotId: "t1", title: "Adubação" }, // próxima
        ],
      }),
      HOJE,
    );
    expect(a.find((x) => x.key === "calendario-2026-08")).toBeDefined();
    expect(a.find((x) => x.key === "atividades-atrasadas")).toBeDefined();
    expect(a.find((x) => x.key === "atividade-proxima-r2")).toBeDefined();
  });

  it("o calendário canônico cobre todos os 12 meses com algum rótulo", () => {
    for (let m = 1; m <= 12; m += 1) {
      expect(CALENDAR.some((e) => e.months.includes(m))).toBe(true);
    }
  });
});
