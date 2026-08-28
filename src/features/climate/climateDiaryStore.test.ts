import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useClimateDiary } from "./climateDiaryStore";
import { pendingCount } from "../../lib/syncOutbox";
import type { DiaryDay } from "../../domain/climateDiary";

function setOnline(v: boolean) {
  Object.defineProperty(navigator, "onLine", { value: v, configurable: true });
}

const day = (date: string, precip = 0, tmin = 15, tmax = 28): DiaryDay => ({ date, tmin, tmax, precip });

describe("useClimateDiary (integração store)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setOnline(true);
  });

  it("captura cria o diário e acumula por data (merge, upsert por dia)", () => {
    const { result } = renderHook(() => useClimateDiary(null));
    act(() => { result.current.capture("t1", [day("2026-08-01", 5), day("2026-08-02", 0)]); });
    expect(result.current.diaryFor("t1")?.days).toHaveLength(2);
    act(() => { result.current.capture("t1", [day("2026-08-02", 12), day("2026-08-03", 3)]); });
    const d = result.current.diaryFor("t1")!;
    expect(d.days).toHaveLength(3);
    expect(d.days.find((x) => x.date === "2026-08-02")!.precip).toBe(12);
  });

  it("no-op canônico: recapturar com as chaves em outra ordem (round-trip jsonb) não reescreve", () => {
    const { result } = renderHook(() => useClimateDiary(null));
    act(() => { result.current.capture("t1", [day("2026-08-01", 5)]); });
    const antes = result.current.diaryFor("t1");
    // Mesmos valores, ordem de chaves diferente (como o Postgres devolve o jsonb).
    act(() => { result.current.capture("t1", [{ date: "2026-08-01", tmax: 28, tmin: 15, precip: 5 }]); });
    // Bail-out do setState (mesma referência): não recriou o diário.
    expect(result.current.diaryFor("t1")).toBe(antes);
  });

  it("captura offline enfileira na outbox e mantém o diário local", () => {
    setOnline(false);
    const { result } = renderHook(() => useClimateDiary("test-user-id"));
    act(() => { result.current.capture("t1", [day("2026-08-01", 5)]); });
    expect(pendingCount()).toBe(1);
    expect(result.current.diaryFor("t1")?.days).toHaveLength(1);
    const ops = JSON.parse(window.localStorage.getItem("agryn.outbox.v1") ?? "[]");
    expect(ops[0].table).toBe("climate_diaries");
    expect(ops[0].onConflict).toBe("user_id,plot_id");
  });
});
