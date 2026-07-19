import { useEffect, useRef, useState } from "react";
import type { FieldRecord, FieldRecordInput } from "../domain/fieldRecords";
import { supabase } from "./supabaseClient";

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
    createdAt: row.created_at,
  };
}

function logSyncError(action: string, error: { message: string } | null) {
  if (error) console.error(`[agryn] falha ao sincronizar ${action}:`, error.message);
}

export function useFieldRecords(userId: string | null = null) {
  const [records, setRecords] = useState<FieldRecord[]>(loadRecords);
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records]);

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
        setRecords(((data as FieldRecordRow[] | null) ?? []).map(recordFromRow));
      });

    return () => {
      active = false;
    };
  }, [userId]);

  return {
    records,
    addRecord(propertyId: string, plotId: string, input: FieldRecordInput) {
      const id = crypto.randomUUID();
      const record: FieldRecord = {
        ...input,
        id,
        propertyId,
        plotId,
        createdAt: new Date().toISOString(),
      };
      setRecords((current) => [record, ...current]);
      if (userId) {
        supabase
          .from("field_records")
          .insert({
            id,
            user_id: userId,
            property_id: propertyId,
            plot_id: plotId,
            ...input,
          })
          .then(({ error }) => logSyncError("novo registro do caderno", error));
      }
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
      setRecords((current) => current.filter((record) => record.id !== recordId));
      if (userId) {
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
