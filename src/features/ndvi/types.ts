export type Position = [longitude: number, latitude: number];

export type GeoPolygon = {
  type: "Polygon";
  coordinates: Position[][];
};

export type StacAsset = {
  href: string;
  title?: string;
  type?: string;
  roles?: string[];
};

export type StacItem = {
  type: "Feature";
  id: string;
  collection?: string;
  bbox?: [number, number, number, number];
  geometry?: GeoJSON.Geometry;
  properties: {
    datetime?: string;
    "eo:cloud_cover"?: number;
    platform?: string;
    constellation?: string;
    "gsd"?: number;
    [key: string]: unknown;
  };
  assets?: Record<string, StacAsset>;
};

export type StacFeatureCollection = {
  type: "FeatureCollection";
  features: StacItem[];
  context?: {
    returned?: number;
    matched?: number;
  };
};

export type NdviScene = {
  id: string;
  collection: string;
  datetime: string;
  sceneCloudCover: number | null;
  platform: string;
  resolutionMeters: number;
  thumbnailUrl: string | null;
  assets: Record<string, StacAsset>;
};

export type NdviClass = {
  id: "muito-baixo" | "baixo" | "moderado" | "alto" | "muito-alto";
  label: string;
  color: string;
  min: number;
  max: number;
  pixelCount: number;
  percentage: number;
  hectares: number;
};

export type NdviStatistics = {
  mean: number;
  minimum: number;
  maximum: number;
  median: number;
  standardDeviation: number;
};

export type AttentionZone = {
  id: string;
  label: string;
  reason: string;
  hectares: number;
  centroid: Position;
  persistenceCount: number;
};

export type NdviLayer = {
  kind: "tiles" | "image";
  url: string;
  bounds?: [[number, number], [number, number]];
};

export type NdviResult = {
  id: string;
  sceneId: string;
  plotId: string;
  source: "sentinel-2-l2a" | "landsat-8-9-l2";
  sensor: string;
  acquiredAt: string;
  processedAt: string;
  resolutionMeters: number;
  totalAreaHectares: number;
  validAreaHectares: number;
  discardedAreaHectares: number;
  validCoveragePercentage: number;
  minimumValidCoveragePercentage: number;
  statistics: NdviStatistics;
  classes: NdviClass[];
  attentionZones: AttentionZone[];
  ndviLayer?: NdviLayer;
  trueColorLayer?: NdviLayer;
  provenance: {
    catalogUrl: string;
    collection: string;
    itemUrl?: string;
    processorVersion: string;
    maskMethod: string;
  };
};

export type NdviJobState =
  | { status: "idle" }
  | { status: "submitting"; message: string }
  | { status: "queued"; jobId: string; progress: number; message: string }
  | { status: "processing"; jobId: string; progress: number; message: string }
  | { status: "completed"; jobId: string; result: NdviResult }
  | { status: "cancelled"; message: string }
  | { status: "error"; message: string };

export type NdviJobResponse = {
  id: string;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  progress?: number;
  message?: string;
  result?: NdviResult;
  error?: {
    code?: string;
    message?: string;
  };
};
