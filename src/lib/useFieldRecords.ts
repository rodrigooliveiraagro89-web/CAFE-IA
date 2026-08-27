import { useEffect, useRef, useState } from "react";
import type { FieldAttachment, FieldRecord, FieldRecordInput } from "../domain/fieldRecords";
import { supabase } from "./supabaseClient";
import { logSyncError } from "./syncError";
import { enqueueWrite, pendingIds } from "./syncOutbox";

const STORAGE_KEY = "agryn.field-records.v1";

type FieldRecordRow = {
  id: string;
  property_id: string;
  plot_id: string;
  type: string;
  title: string;
  date: string;
  notes: string;
  status: "planejada" | "concluida";
  cost: number;
  quantity: string;
  unit: string;
  attachments?: FieldAttachment[] | null;
  created_at: string;
};

function recordFromRow(row: FieldRecordRow): FieldRecord {
  return {
    id: row.id,
    propertyId: row.property_id,
    plotId: row.plot_id,
    type: row.type,
    title: row.title,
    date: row.date,
    notes: row.notes,
    status: row.status,
    cost: Number(row.cost),
    quantity: row.quantity,
    unit: row.unit,
    attachments: row.attachments ?? [],
    createdAt: row.created_at,
  };
}


export function useFieldRecords(userId: string | null = null) {
  const [records, setRecords] = useState<FieldRecord[]>(loadRecords);
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records]);

  useEffect(() => {
    if (!userId) return;
    const syncPending = async () => {
      if (!navigator.onLine || records.length === 0) return;
      const { error } = await supabase.from("field_records").upsert(
        records.map((record) => ({
          id: record.id,
          user_id: userId,
          property_id: record.propertyId,
          plot_id: record.plotId,
          type: record.type,
          title: record.title,
          date: record.date,
          notes: record.notes,
          status: record.status,
          cost: record.cost,
          quantity: record.quantity,
          unit: record.unit,
          attachments: record.attachments,
          created_at: record.createdAt,
        })),
      );
      logSyncError("registros offline", error);
    };
    const onSync = () => { void syncPending(); };
    window.addEventListener("online", onSync);
    window.addEventListener("agryn:context-synced", onSync);
    return () => {
      window.removeEventListener("online", onSync);
      window.removeEventListener("agryn:context-synced", onSync);
    };
  }, [records, userId]);

  useEffect(() => {
    if (!userId) {
      if (previousUserId.current) {
        window.localStorage.removeItem(STORAGE_KEY);
        setRecords([]);
      }
      previousUserId.current = null;
      return;
    }
    previousUserId.current = userId;

    let active = true;
    supabase
      .from("field_records")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;
        logSyncError("caderno de campo", error);
        if (error) return;
        // Merge (não sobrescreve): preserva SÓ os registros locais que ainda
        // estão pendentes na outbox (criados offline e não sincronizados) que a
        // nuvem não conhece — senão um reabrir já-online os descartaria. Não
        // preserva cruft local sem op pendente (evita ressuscitar exclusões).
        const cloud = ((data as FieldRecordRow[] | null) ?? []).map(recordFromRow);
        const pend = pendingIds();
        setRecords((local) => {
          const cloudIds = new Set(cloud.map((record) => record.id));
          const pendentes = local.filter(
            (record) => !cloudIds.has(record.id) && pend.has(`field_records:${record.id}`),
          );
          return [...pendentes, ...cloud];
        });
      });

    return () => {
      active = false;
    };
  }, [userId]);

  return {
    records,
    async addRecord(propertyId: string, plotId: string, input: FieldRecordInput, files: File[] = []) {
      const id = crypto.randomUUID();
      const record: FieldRecord = {
        ...input,
        attachments: input.attachments ?? [],
        id,
        propertyId,
        plotId,
        createdAt: new Date().toISOString(),
      };
      setRecords((current) => [record, ...current]);
      if (userId) {
        // Escrita durável: mesmo criado offline, o registro entra na outbox e
        // sincroniza ao reconectar (upsert idempotente por id). Antes o insert
        // era condicionado a navigator.onLine e um registro offline podia se
        // perder num reabrir já-online (o fetch sobrescrevia o estado local).
        const linhaBase = {
          id,
          user_id: userId,
          property_id: propertyId,
          plot_id: plotId,
          type: record.type,
          title: record.title,
          date: record.date,
          notes: record.notes,
          status: record.status,
          cost: record.cost,
          quantity: record.quantity,
          unit: record.unit,
          attachments: record.attachments,
          created_at: record.createdAt,
        };
        enqueueWrite({ id: `field_records:${id}`, table: "field_records", onConflict: "id", label: "novo registro do caderno", payload: linhaBase });
        // Anexos exigem rede (upload no Storage); só quando online. A linha é
        // re-enfileirada com os anexos para que o metadado também seja durável.
        if (files.length > 0 && navigator.onLine) {
          const attachments: FieldAttachment[] = [];
          for (const file of files.slice(0, 4)) {
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
            const path = `${userId}/${id}/${crypto.randomUUID()}-${safeName}`;
            const { error: uploadError } = await supabase.storage
              .from("field-attachments")
              .upload(path, file, { contentType: file.type, upsert: false });
            logSyncError("anexo do caderno", uploadError);
            if (!uploadError) attachments.push({ path, name: file.name, mimeType: file.type, size: file.size });
          }
          if (attachments.length) {
            setRecords((current) => current.map((item) => item.id === id ? { ...item, attachments } : item));
            enqueueWrite({ id: `field_records:${id}`, table: "field_records", onConflict: "id", label: "anexos do registro", payload: { ...linhaBase, attachments } });
          }
        }
      }
      // Devolve o id para quem precisa vincular o registro (ex.: item do plano
      // de safra que virou realizado no caderno).
      return id;
    },
    toggleRecord(recordId: string) {
      const target = records.find((record) => record.id === recordId);
      if (!target) return;
      const nextStatus: FieldRecord["status"] = target.status === "concluida" ? "planejada" : "concluida";
      setRecords((current) =>
        current.map((record) => (record.id === recordId ? { ...record, status: nextStatus } : record)),
      );
      if (userId) {
        supabase
          .from("field_records")
          .update({ status: nextStatus })
          .eq("id", recordId)
          .then(({ error }) => logSyncError("status do registro", error));
      }
    },
    removeRecord(recordId: string) {
      if (userId && !navigator.onLine) {
        window.alert("Conecte-se para excluir a atividade e seus anexos com segurança da nuvem.");
        return;
      }
      const target = records.find((record) => record.id === recordId);
      setRecords((current) => current.filter((record) => record.id !== recordId));
      if (userId) {
        const paths = target?.attachments.map((attachment) => attachment.path) ?? [];
        if (paths.length) {
          void supabase.storage.from("field-attachments").remove(paths).then(({ error }) => logSyncError("remoção dos anexos", error));
        }
        supabase
          .from("field_records")
          .delete()
          .eq("id", recordId)
          .then(({ error }) => logSyncError("remoção do registro", error));
      }
    },
  };
}

function loadRecords(): FieldRecord[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}
