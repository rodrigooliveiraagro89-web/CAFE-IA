// Unidades comuns oferecidas como sugestão de toque no caderno de campo.
// Datalist (não select): o produtor toca numa opção ou digita a própria.
export const commonUnits = [
  "kg",
  "sacas",
  "L",
  "mL",
  "g",
  "t",
  "un",
  "h",
  "m",
  "ha",
  "%",
] as const;

export const activityTypes = [
  "Plantio",
  "Adubação",
  "Pulverização",
  "Irrigação",
  "Análise",
  "Inspeção",
  "Praga ou doença",
  "Colheita",
  "Custo",
  "Observação",
  "Documento",
  "NDVI",
  "Clima",
] as const;

export type FieldRecord = {
  id: string;
  propertyId: string;
  plotId: string;
  type: string;
  title: string;
  date: string;
  notes: string;
  status: "planejada" | "concluida";
  cost: number;
  quantity: string;
  unit: string;
  createdAt: string;
};

export type FieldRecordInput = Omit<FieldRecord, "id" | "propertyId" | "plotId" | "createdAt">;

export function summarizeCosts(records: FieldRecord[]) {
  const withCosts = records.filter((record) => Number.isFinite(record.cost) && record.cost > 0);
  const total = withCosts.reduce((sum, record) => sum + record.cost, 0);
  const byCategory = withCosts.reduce<Record<string, number>>((summary, record) => {
    summary[record.type] = (summary[record.type] ?? 0) + record.cost;
    return summary;
  }, {});
  return { total, byCategory, entries: withCosts.length };
}
