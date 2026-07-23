// Interpretação agronômica determinística de análise de solo. A IA (backend) só
// EXTRAI os números do laudo; a leitura das faixas é feita aqui, por código
// auditável, com limites de referência CFSEMG/Boletim 100 declarados abaixo.
// Observação: P e K variam com textura/argila; as faixas abaixo são referência
// geral e não substituem o laudo com P-remanescente e a análise do responsável.

export type SoilLevel = "baixo" | "adequado" | "alto" | "informativo";

export type SoilValues = {
  ph?: number | null;
  p?: number | null;
  k?: number | null;
  ca?: number | null;
  mg?: number | null;
  s?: number | null;
  ctc?: number | null;
  vPercent?: number | null;
  mPercent?: number | null;
  organicMatter?: number | null;
  zn?: number | null;
  b?: number | null;
  fe?: number | null;
  mn?: number | null;
  cu?: number | null;
};

export type SoilFieldKey = keyof SoilValues;

type Reference = {
  key: SoilFieldKey;
  label: string;
  unit: string;
  low?: number; // abaixo de low → "baixo"
  high?: number; // acima de high → "alto"
  // Para a maioria dos nutrientes, "baixo" é o problema. Para m% (alumínio),
  // é o "alto" que preocupa — riskySide inverte o alerta.
  riskySide: "baixo" | "alto" | "nenhum";
};

// Faixas de referência (CFSEMG / Boletim 100, uso geral).
export const SOIL_REFERENCES: Reference[] = [
  { key: "ph", label: "pH", unit: "", low: 5.5, high: 6.5, riskySide: "baixo" },
  { key: "p", label: "Fósforo (P)", unit: "mg/dm³", low: 10, high: 20, riskySide: "baixo" },
  { key: "k", label: "Potássio (K)", unit: "mg/dm³", low: 40, high: 120, riskySide: "baixo" },
  { key: "ca", label: "Cálcio (Ca)", unit: "cmolc/dm³", low: 1.5, high: 4, riskySide: "baixo" },
  { key: "mg", label: "Magnésio (Mg)", unit: "cmolc/dm³", low: 0.5, high: 1, riskySide: "baixo" },
  { key: "s", label: "Enxofre (S)", unit: "mg/dm³", low: 5, high: 10, riskySide: "baixo" },
  { key: "ctc", label: "CTC (T)", unit: "cmolc/dm³", riskySide: "nenhum" },
  { key: "vPercent", label: "Saturação por bases (V%)", unit: "%", low: 50, high: 70, riskySide: "baixo" },
  { key: "mPercent", label: "Saturação por alumínio (m%)", unit: "%", low: 10, high: 20, riskySide: "alto" },
  { key: "organicMatter", label: "Matéria orgânica", unit: "dag/kg", low: 2, high: 4, riskySide: "baixo" },
  { key: "zn", label: "Zinco (Zn)", unit: "mg/dm³", low: 1, high: 1.6, riskySide: "baixo" },
  { key: "b", label: "Boro (B)", unit: "mg/dm³", low: 0.4, high: 0.8, riskySide: "baixo" },
  { key: "fe", label: "Ferro (Fe)", unit: "mg/dm³", riskySide: "nenhum" },
  { key: "mn", label: "Manganês (Mn)", unit: "mg/dm³", riskySide: "nenhum" },
  { key: "cu", label: "Cobre (Cu)", unit: "mg/dm³", low: 0.4, high: 1.2, riskySide: "baixo" },
];

export type SoilInterpretationRow = {
  key: SoilFieldKey;
  label: string;
  unit: string;
  value: number;
  level: SoilLevel;
  riskySide: "baixo" | "alto" | "nenhum";
};

function classify(reference: Reference, value: number): SoilLevel {
  if (reference.low === undefined && reference.high === undefined) return "informativo";
  if (reference.low !== undefined && value < reference.low) return "baixo";
  if (reference.high !== undefined && value > reference.high) return "alto";
  return "adequado";
}

export function interpretSoil(values: SoilValues): SoilInterpretationRow[] {
  const rows: SoilInterpretationRow[] = [];
  for (const reference of SOIL_REFERENCES) {
    const value = values[reference.key];
    if (value === null || value === undefined || !Number.isFinite(value)) continue;
    rows.push({
      key: reference.key,
      label: reference.label,
      unit: reference.unit,
      value,
      level: classify(reference, value),
      riskySide: reference.riskySide,
    });
  }
  return rows;
}

// Gera avisos só onde há um problema real (nutriente no lado de risco). Valores
// ausentes nunca geram alerta.
export function soilAlerts(rows: SoilInterpretationRow[]): string[] {
  const alerts: string[] = [];
  for (const row of rows) {
    if (row.riskySide === "nenhum") continue;
    if (row.level === row.riskySide) {
      if (row.key === "mPercent") {
        alerts.push("Saturação por alumínio (m%) alta — avaliar calagem.");
      } else if (row.key === "vPercent") {
        alerts.push("Saturação por bases (V%) abaixo do alvo — considerar correção.");
      } else {
        alerts.push(`${row.label} ${row.level === "baixo" ? "baixo" : "alto"} — atenção.`);
      }
    }
  }
  return alerts;
}

export function soilLevelLabel(level: SoilLevel): string {
  switch (level) {
    case "baixo":
      return "Baixo";
    case "alto":
      return "Alto";
    case "adequado":
      return "Adequado";
    default:
      return "—";
  }
}
