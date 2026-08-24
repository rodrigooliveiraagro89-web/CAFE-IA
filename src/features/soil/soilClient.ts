import { getProcessingApiUrl } from "../ndvi/processingClient";
import { AI_TIMEOUT_MS, fetchWithTimeout } from "../../lib/http";
import type { SoilValues } from "../../domain/soilAnalysis";

// Mapeia o JSON do backend (snake_case) para o SoilValues do domínio (camelCase).
type RawSoilValues = {
  label?: string | null;
  ph?: number | null;
  p?: number | null;
  k?: number | null;
  ca?: number | null;
  mg?: number | null;
  s?: number | null;
  ctc?: number | null;
  v_percent?: number | null;
  m_percent?: number | null;
  organic_matter?: number | null;
  zn?: number | null;
  b?: number | null;
  fe?: number | null;
  mn?: number | null;
  cu?: number | null;
  p_rem?: number | null;
  al?: number | null;
  h_al?: number | null;
  argila?: number | null;
  extrator_b?: string | null;
  extrator_micros?: string | null;
  analysis_date?: string | null;
  laboratory?: string | null;
};

// Normaliza o nome do extrator do laudo (texto livre) para os valores canônicos.
function normalizarExtratorB(raw?: string | null): "mehlich1" | "hcl" | "agua_quente" | null {
  const t = (raw ?? "").toLowerCase();
  if (!t) return null;
  if (t.includes("quente") || t.includes("água") || t.includes("agua")) return "agua_quente";
  if (t.includes("hcl")) return "hcl";
  if (t.includes("mehlich") || t.includes("m-1") || t.includes("m1")) return "mehlich1";
  return null;
}
function normalizarExtratorMicros(raw?: string | null): "mehlich1" | "dtpa" | null {
  const t = (raw ?? "").toLowerCase();
  if (!t) return null;
  if (t.includes("dtpa")) return "dtpa";
  if (t.includes("mehlich") || t.includes("m-1") || t.includes("m1")) return "mehlich1";
  return null;
}

export type SoilExtraction = {
  label: string | null;
  values: SoilValues;
  analysisDate: string | null;
  laboratory: string | null;
};

function fromRaw(raw: RawSoilValues): SoilExtraction {
  return {
    label: raw.label ?? null,
    values: {
      ph: raw.ph ?? null,
      p: raw.p ?? null,
      k: raw.k ?? null,
      ca: raw.ca ?? null,
      mg: raw.mg ?? null,
      s: raw.s ?? null,
      ctc: raw.ctc ?? null,
      vPercent: raw.v_percent ?? null,
      mPercent: raw.m_percent ?? null,
      organicMatter: raw.organic_matter ?? null,
      zn: raw.zn ?? null,
      b: raw.b ?? null,
      fe: raw.fe ?? null,
      mn: raw.mn ?? null,
      cu: raw.cu ?? null,
      pRem: raw.p_rem ?? null,
      al: raw.al ?? null,
      hAl: raw.h_al ?? null,
      argila: raw.argila ?? null,
      extratorB: normalizarExtratorB(raw.extrator_b),
      extratorMicros: normalizarExtratorMicros(raw.extrator_micros),
    },
    analysisDate: raw.analysis_date ?? null,
    laboratory: raw.laboratory ?? null,
  };
}

async function responseMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string; detail?: string };
    return payload.message || payload.detail || fallback;
  } catch {
    return fallback;
  }
}

export async function extractSoilFromFile(
  file: File,
  accessToken: string,
): Promise<SoilExtraction[]> {
  const apiUrl = getProcessingApiUrl();
  if (!apiUrl) {
    throw new Error(
      "O serviço de leitura por IA não está configurado. Você pode digitar os valores do laudo manualmente.",
    );
  }

  const body = new FormData();
  body.append("file", file);

  const response = await fetchWithTimeout(
    `${apiUrl}/v1/soil/extract`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body,
    },
    AI_TIMEOUT_MS,
  );

  if (!response.ok) {
    throw new Error(await responseMessage(response, "Não foi possível ler o laudo."));
  }

  const payload = (await response.json()) as {
    samples?: RawSoilValues[];
    values?: RawSoilValues;
  };
  // Novo formato: lista de amostras. Compat.: `values` como amostra única.
  const raw = payload.samples?.length
    ? payload.samples
    : payload.values
      ? [payload.values]
      : [];
  if (raw.length === 0) {
    throw new Error("A leitura do laudo não retornou amostras. Tente outra foto.");
  }
  return raw.map(fromRaw);
}
