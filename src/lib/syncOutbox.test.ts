import { beforeEach, describe, expect, it } from "vitest";
import { enqueueDelete, enqueueWrite, flushOutbox, pendingCount } from "./syncOutbox";

function setOnline(v: boolean) {
  Object.defineProperty(navigator, "onLine", { value: v, configurable: true });
}

const op = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  table: "soil_analyses",
  onConflict: "id",
  label: "solo",
  payload: { id: id.split(":")[1], ...extra },
});

describe("syncOutbox (fila offline durável)", () => {
  beforeEach(() => window.localStorage.clear());

  it("offline: enfileira e não perde; ao reconectar, sincroniza e limpa", async () => {
    setOnline(false);
    enqueueWrite(op("soil_analyses:a1"));
    expect(pendingCount()).toBe(1);

    // Mesmo id não duplica (a mais recente vence).
    enqueueWrite(op("soil_analyses:a1", { v: 2 }));
    expect(pendingCount()).toBe(1);

    // Um segundo item distinto soma na fila.
    enqueueWrite(op("soil_analyses:a2"));
    expect(pendingCount()).toBe(2);

    // Conexão volta → flush envia (mock retorna error null) e limpa a fila.
    setOnline(true);
    await flushOutbox();
    expect(pendingCount()).toBe(0);
  });

  it("online: enqueue sincroniza na hora (fila fica vazia)", async () => {
    setOnline(true);
    enqueueWrite(op("soil_analyses:b1"));
    await new Promise((r) => setTimeout(r, 0)); // deixa o flush disparado concluir
    expect(pendingCount()).toBe(0);
  });

  it("offline: flush é no-op (mantém a fila intacta)", async () => {
    setOnline(false);
    enqueueWrite(op("soil_analyses:c1"));
    await flushOutbox();
    expect(pendingCount()).toBe(1);
    setOnline(true);
  });

  it("delete durável: offline enfileira, reconectar apaga e limpa; dedup substitui upsert pendente", async () => {
    setOnline(false);
    enqueueDelete({ id: "crop_plans:p1", table: "crop_plans", match: { id: "p1" }, label: "remoção do plano" });
    expect(pendingCount()).toBe(1);
    setOnline(true);
    await flushOutbox();
    expect(pendingCount()).toBe(0);
  });

  it("delete substitui um upsert pendente do mesmo id (nunca recria após excluir)", async () => {
    setOnline(false);
    enqueueWrite({ id: "crop_plans:p2", table: "crop_plans", onConflict: "id", label: "plano", payload: { id: "p2" } });
    enqueueDelete({ id: "crop_plans:p2", table: "crop_plans", match: { id: "p2" }, label: "remoção" });
    // Mesma chave de dedup: fica só a exclusão na fila.
    expect(pendingCount()).toBe(1);
    setOnline(true);
    await flushOutbox();
    expect(pendingCount()).toBe(0);
  });
});
