export type SoilAnalysisDraft = {
  propertyId?: string;
  plotId?: string;
  laboratory?: string;
  sampledAt?: string;
  pH?: number;
  organicMatter?: number;
  phosphorus?: number;
  potassium?: number;
  calcium?: number;
  magnesium?: number;
  cec?: number;
  baseSaturation?: number;
};

export type SafetyCheck = {
  eligible: boolean;
  missing: string[];
  invalid: string[];
  message: string;
};

const REQUIRED_TEXT_FIELDS: Array<[keyof SoilAnalysisDraft, string]> = [
  ["propertyId", "Propriedade"],
  ["plotId", "Talhão"],
  ["laboratory", "Laboratório"],
  ["sampledAt", "Data da coleta"],
];

const REQUIRED_NUMERIC_FIELDS: Array<[keyof SoilAnalysisDraft, string]> = [
  ["pH", "pH"],
  ["organicMatter", "Matéria orgânica"],
  ["phosphorus", "Fósforo"],
  ["potassium", "Potássio"],
  ["calcium", "Cálcio"],
  ["magnesium", "Magnésio"],
  ["cec", "CTC"],
  ["baseSaturation", "Saturação por bases"],
];

const PLAUSIBLE_RANGES: Partial<Record<keyof SoilAnalysisDraft, [number, number]>> = {
  pH: [2.5, 9],
  organicMatter: [0, 200],
  phosphorus: [0, 500],
  potassium: [0, 1000],
  calcium: [0, 30],
  magnesium: [0, 15],
  cec: [0.1, 80],
  baseSaturation: [0, 100],
};

export function evaluateRecommendationReadiness(draft?: SoilAnalysisDraft): SafetyCheck {
  if (!draft) {
    return {
      eligible: false,
      missing: [...REQUIRED_TEXT_FIELDS, ...REQUIRED_NUMERIC_FIELDS].map(([, label]) => label),
      invalid: [],
      message: "Recomendação bloqueada: nenhuma análise de solo foi confirmada.",
    };
  }

  const missing = REQUIRED_TEXT_FIELDS.filter(([key]) => {
    const value = draft[key];
    return typeof value !== "string" || value.trim().length === 0;
  }).map(([, label]) => label);

  missing.push(
    ...REQUIRED_NUMERIC_FIELDS.filter(([key]) => {
      const value = draft[key];
      return typeof value !== "number" || !Number.isFinite(value);
    }).map(([, label]) => label),
  );

  const invalid = REQUIRED_NUMERIC_FIELDS.filter(([key]) => {
    const value = draft[key];
    const range = PLAUSIBLE_RANGES[key];
    return typeof value === "number" && range !== undefined && (value < range[0] || value > range[1]);
  }).map(([, label]) => label);

  const eligible = missing.length === 0 && invalid.length === 0;
  return {
    eligible,
    missing,
    invalid,
    message: eligible
      ? "Dados mínimos validados. A análise pode seguir para revisão técnica."
      : "Recomendação bloqueada até a correção dos dados obrigatórios.",
  };
}
