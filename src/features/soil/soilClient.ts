import { getProcessingApiUrl } from "../ndvi/processingClient";
import type { SoilValues } from "../../domain/soilAnalysis";

// Mapeia o JSON do backend (snake_case) para o SoilValues do domínio (camelCase).
type RawSoilValues = {
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
  analysis_date?: string | null;
  laboratory?: string | null;
};

export type SoilExtraction = {
  values: SoilValues;
  analysisDate: string | null;
  laboratory: string | null;
};

function fromRaw(raw: RawSoilValues): SoilExtraction {
  return {
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
): Promise<SoilExtraction> {
  const apiUrl = getProcessingApiUrl();
  if (!apiUrl) {
    throw new Error(
      "O serviço de leitura por IA não está configurado. Você pode digitar os valores do laudo manualmente.",
    );
  }

  const body = new FormData();
  body.append("file", file);

  const response = await fetch(`${apiUrl}/v1/soil/extract`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body,
  });

  if (!response.ok) {
    throw new Error(await responseMessage(response, "Não foi possível ler o laudo."));
  }

  const payload = (await response.json()) as { values: RawSoilValues };
  return fromRaw(payload.values);
}
