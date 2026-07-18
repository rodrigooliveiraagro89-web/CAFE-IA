import type { GeoPolygon, NdviJobResponse, NdviResult } from "./types";

const POLL_INTERVAL_MS = 1_800;
const MAX_POLLS = 100;

export type ProcessNdviInput = {
  sceneId: string;
  collection: string;
  polygon: GeoPolygon;
  plotId: string;
  minimumValidCoveragePercentage: number;
};

export function getProcessingApiUrl(): string | null {
  const value = import.meta.env.VITE_NDVI_API_URL?.trim();
  return value ? value.replace(/\/$/, "") : null;
}

export async function processNdvi(
  input: ProcessNdviInput,
  onProgress: (job: NdviJobResponse) => void,
  signal?: AbortSignal,
): Promise<NdviResult> {
  const apiUrl = getProcessingApiUrl();
  if (!apiUrl) {
    throw new Error(
      "O serviço geoespacial não está configurado. A busca de cenas está ativa, mas o raster NDVI não será fabricado no navegador.",
    );
  }

  const submission = await fetch(`${apiUrl}/v1/ndvi/jobs`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      scene_id: input.sceneId,
      collection: input.collection,
      geometry: input.polygon,
      plot_id: input.plotId,
      minimum_valid_coverage_percentage: input.minimumValidCoveragePercentage,
      algorithm: {
        index: "NDVI",
        red_band: "B04",
        nir_band: "B08",
        quality_band: "SCL",
        excluded_scl_classes: [0, 1, 3, 7, 8, 9, 10, 11],
      },
    }),
    signal,
  });

  if (!submission.ok) {
    throw new Error(await responseMessage(submission, "Não foi possível iniciar o processamento."));
  }

  const initial = (await submission.json()) as NdviJobResponse;
  onProgress(initial);
  if (initial.status === "completed" && initial.result) return initial.result;

  for (let attempt = 0; attempt < MAX_POLLS; attempt += 1) {
    await abortableDelay(POLL_INTERVAL_MS, signal);
    const response = await fetch(`${apiUrl}/v1/ndvi/jobs/${encodeURIComponent(initial.id)}`, {
      headers: { Accept: "application/json" },
      signal,
    });

    if (!response.ok) {
      throw new Error(await responseMessage(response, "Falha ao consultar o processamento."));
    }

    const job = (await response.json()) as NdviJobResponse;
    onProgress(job);

    if (job.status === "completed" && job.result) return job.result;
    if (job.status === "failed") {
      throw new Error(job.error?.message || "O processamento geoespacial não foi concluído.");
    }
    if (job.status === "cancelled") throw new Error("Processamento cancelado.");
  }

  throw new Error("O processamento excedeu o tempo de espera. O trabalho pode continuar na fila.");
}

export async function cancelNdviJob(jobId: string): Promise<void> {
  const apiUrl = getProcessingApiUrl();
  if (!apiUrl) return;

  await fetch(`${apiUrl}/v1/ndvi/jobs/${encodeURIComponent(jobId)}`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });
}

async function responseMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string; detail?: string };
    return payload.message || payload.detail || fallback;
  } catch {
    return fallback;
  }
}

function abortableDelay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timeout);
        reject(new DOMException("Operação cancelada.", "AbortError"));
      },
      { once: true },
    );
  });
}
