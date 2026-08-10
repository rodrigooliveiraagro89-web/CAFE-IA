import { getProcessingApiUrl } from "../ndvi/processingClient";
import { AI_TIMEOUT_MS, fetchWithTimeout } from "../../lib/http";

export type Confianca = "baixa" | "media" | "alta";

export type Diagnosis = {
  provavel: string;
  confianca: Confianca;
  sinaisObservados: string[];
  possiveisCausas: string[];
  manejoGeral: string[];
  recomendaConfirmar: string;
};

type RawDiagnosis = {
  provavel?: string;
  confianca?: Confianca;
  sinais_observados?: string[];
  possiveis_causas?: string[];
  manejo_geral?: string[];
  recomenda_confirmar?: string;
};

function fromRaw(raw: RawDiagnosis): Diagnosis {
  return {
    provavel: raw.provavel ?? "Não identificado",
    confianca: raw.confianca ?? "baixa",
    sinaisObservados: raw.sinais_observados ?? [],
    possiveisCausas: raw.possiveis_causas ?? [],
    manejoGeral: raw.manejo_geral ?? [],
    recomendaConfirmar: raw.recomenda_confirmar ?? "",
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

export async function diagnoseImage(file: File, accessToken: string): Promise<Diagnosis> {
  const apiUrl = getProcessingApiUrl();
  if (!apiUrl) {
    throw new Error("O diagnóstico por IA não está configurado no momento.");
  }

  const body = new FormData();
  body.append("file", file);

  const response = await fetchWithTimeout(
    `${apiUrl}/v1/vision/diagnose`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body,
    },
    AI_TIMEOUT_MS,
  );

  if (!response.ok) {
    throw new Error(await responseMessage(response, "Não foi possível analisar a foto."));
  }

  const payload = (await response.json()) as { diagnosis: RawDiagnosis };
  return fromRaw(payload.diagnosis);
}
