import { useEffect, useState } from "react";
import { newId } from "../domain/agriculturalContext";
import type { FieldRecord, FieldRecordInput } from "../domain/fieldRecords";

const STORAGE_KEY = "agryn.field-records.v1";

export function useFieldRecords() {
  const [records, setRecords] = useState<FieldRecord[]>(loadRecords);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records]);

  return {
    records,
    addRecord(propertyId: string, plotId: string, input: FieldRecordInput) {
      setRecords((current) => [
        {
          ...input,
          id: newId("record"),
          propertyId,
          plotId,
          createdAt: new Date().toISOString(),
        },
        ...current,
      ]);
    },
    toggleRecord(recordId: string) {
      setRecords((current) =>
        current.map((record) =>
          record.id === recordId
            ? {
                ...record,
                status: record.status === "concluida" ? "planejada" : "concluida",
              }
            : record,
        ),
      );
    },
    removeRecord(recordId: string) {
      setRecords((current) => current.filter((record) => record.id !== recordId));
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
