import { buildSentinelSearchBody, normalizeStacItem } from "./domain";
import type { GeoPolygon, NdviScene, StacFeatureCollection } from "./types";

const DEFAULT_STAC_URL = "https://stac.dataspace.copernicus.eu/v1";

export class NdviCatalogError extends Error {
  constructor(
    message: string,
    readonly code:
      | "AUTHENTICATION"
      | "RATE_LIMIT"
      | "NO_RESULTS"
      | "OUTSIDE_COVERAGE"
      | "NETWORK"
      | "INVALID_RESPONSE",
  ) {
    super(message);
  }
}

export type SceneSearchInput = {
  polygon: GeoPolygon;
  dateStart: string;
  dateEnd: string;
  maximumCloudCover: number;
  signal?: AbortSignal;
};

export function getStacRootUrl(): string {
  return (import.meta.env.VITE_NDVI_STAC_URL || DEFAULT_STAC_URL).replace(/\/$/, "");
}

export async function searchSentinelScenes(input: SceneSearchInput): Promise<NdviScene[]> {
  let response: Response;

  try {
    response = await fetch(`${getStacRootUrl()}/search`, {
      method: "POST",
      headers: {
        Accept: "application/geo+json, application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        buildSentinelSearchBody(
          input.polygon,
          input.dateStart,
          input.dateEnd,
          input.maximumCloudCover,
        ),
      ),
      signal: input.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new NdviCatalogError(
      "Não foi possível acessar o catálogo Copernicus. Verifique a conexão e tente novamente.",
      "NETWORK",
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new NdviCatalogError(
      "O catálogo solicitou autenticação. Revise a configuração da fonte NDVI.",
      "AUTHENTICATION",
    );
  }

  if (response.status === 429) {
    throw new NdviCatalogError(
      "O limite temporário do catálogo foi atingido. Aguarde alguns minutos e tente novamente.",
      "RATE_LIMIT",
    );
  }

  if (!response.ok) {
    throw new NdviCatalogError(
      `O catálogo Copernicus respondeu com erro ${response.status}.`,
      "NETWORK",
    );
  }

  let payload: StacFeatureCollection;
  try {
    payload = (await response.json()) as StacFeatureCollection;
  } catch {
    throw new NdviCatalogError(
      "O catálogo retornou uma resposta que não pôde ser interpretada.",
      "INVALID_RESPONSE",
    );
  }

  if (!Array.isArray(payload.features)) {
    throw new NdviCatalogError(
      "A resposta do catálogo não contém a lista de imagens esperada.",
      "INVALID_RESPONSE",
    );
  }

  const scenes = payload.features
    .map(normalizeStacItem)
    .filter((scene): scene is NdviScene => scene !== null)
    .sort((left, right) => {
      const leftCloud = left.sceneCloudCover ?? 101;
      const rightCloud = right.sceneCloudCover ?? 101;
      return leftCloud - rightCloud || right.datetime.localeCompare(left.datetime);
    });

  if (scenes.length === 0) {
    throw new NdviCatalogError(
      "Nenhuma imagem Sentinel-2 L2A foi encontrada para este período e limite de nuvens.",
      "NO_RESULTS",
    );
  }

  return scenes;
}
