import { useState } from "react";
import { emptyAgriculturalContext, type AgriculturalContextState } from "../../domain/agriculturalContext";
import type { FieldRecord } from "../../domain/fieldRecords";
import { CONTEXT_SNAPSHOT_KEY, RECORDS_SNAPSHOT_KEY } from "../../lib/localDataSnapshot";
import { supabase } from "../../lib/supabaseClient";

type ImportLocalDataDialogProps = {
  userId: string;
  onDone: () => void;
};

function readSnapshot(): { context: AgriculturalContextState; records: FieldRecord[] } {
  try {
    const contextRaw = window.localStorage.getItem(CONTEXT_SNAPSHOT_KEY);
    const recordsRaw = window.localStorage.getItem(RECORDS_SNAPSHOT_KEY);
    const context = contextRaw ? (JSON.parse(contextRaw) as AgriculturalContextState) : emptyAgriculturalContext;
    const records = recordsRaw ? (JSON.parse(recordsRaw) as FieldRecord[]) : [];
    return { context, records };
  } catch {
    return { context: emptyAgriculturalContext, records: [] };
  }
}

function clearSnapshot() {
  window.localStorage.removeItem(CONTEXT_SNAPSHOT_KEY);
  window.localStorage.removeItem(RECORDS_SNAPSHOT_KEY);
}

export function ImportLocalDataDialog({ userId, onDone }: ImportLocalDataDialogProps) {
  const [snapshot] = useState(readSnapshot);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");

  const { properties, plots } = snapshot.context;
  const records = snapshot.records;

  if (properties.length === 0) return null;

  async function importAll() {
    setImporting(true);
    setError("");
    try {
      const propertyIdMap = new Map<string, string>();
      for (const property of properties) {
        const newId = crypto.randomUUID();
        const { error: insertError } = await supabase.from("properties").insert({
          id: newId,
          user_id: userId,
          name: property.name,
          producer: property.producer,
          responsible: property.responsible,
          city: property.city,
          state: property.state,
        });
        if (insertError) throw new Error(insertError.message);
        propertyIdMap.set(property.id, newId);
      }

      const plotIdMap = new Map<string, string>();
      for (const plot of plots) {
        const newPropertyId = propertyIdMap.get(plot.propertyId);
        if (!newPropertyId) continue;
        const newId = crypto.randomUUID();
        const { error: insertError } = await supabase.from("plots").insert({
          id: newId,
          user_id: userId,
          property_id: newPropertyId,
          name: plot.name,
          crop: plot.crop,
          variety: plot.variety,
          season: plot.season,
          planting_date: plot.plantingDate,
          phenological_stage: plot.phenologicalStage,
          row_spacing: plot.rowSpacing,
          plant_spacing: plot.plantSpacing,
          population: plot.population,
          area_hectares: plot.areaHectares,
          geometry: plot.geometry,
        });
        if (insertError) throw new Error(insertError.message);
        plotIdMap.set(plot.id, newId);
      }

      for (const record of records) {
        const newPropertyId = propertyIdMap.get(record.propertyId);
        const newPlotId = plotIdMap.get(record.plotId);
        if (!newPropertyId || !newPlotId) continue;
        const { error: insertError } = await supabase.from("field_records").insert({
          id: crypto.randomUUID(),
          user_id: userId,
          property_id: newPropertyId,
          plot_id: newPlotId,
          type: record.type,
          title: record.title,
          date: record.date,
          notes: record.notes,
          status: record.status,
          cost: record.cost,
          quantity: record.quantity,
          unit: record.unit,
        });
        if (insertError) throw new Error(insertError.message);
      }

      clearSnapshot();
      onDone();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Não foi possível importar os dados.");
      setImporting(false);
    }
  }

  function dismiss() {
    clearSnapshot();
    onDone();
  }

  return (
    <div className="import-overlay" role="dialog" aria-modal="true" aria-labelledby="import-dialog-title">
      <div className="import-card">
        <h2 id="import-dialog-title">Encontramos dados salvos neste navegador</h2>
        <p>
          {properties.length} propriedade(s) e {plots.length} talhão(ões) cadastrados antes de
          você entrar na conta. Quer importar tudo para sua conta agora?
        </p>
        {error && <p className="auth-error">{error}</p>}
        <div className="import-actions">
          <button type="button" onClick={dismiss} disabled={importing}>
            Não importar
          </button>
          <button type="button" className="auth-submit" onClick={importAll} disabled={importing}>
            {importing ? "Importando..." : "Importar"}
          </button>
        </div>
      </div>
    </div>
  );
}
