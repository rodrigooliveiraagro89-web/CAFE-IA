from __future__ import annotations

import asyncio
import time
from datetime import datetime, timedelta, timezone
from io import BytesIO

import httpx
import numpy as np
import rasterio
from pyproj import Geod
from shapely.geometry import Polygon

from .analysis import (
    build_attention_zones,
    classify_general,
    classify_relative,
    percentage,
    polygon_area_hectares,
    render_ndvi_png,
    summarize_quality,
    summarize_values,
)
from .config import settings
from .models import NdviJobInput


TOKEN_URL = (
    "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/"
    "protocol/openid-connect/token"
)
PROCESS_URL = "https://sh.dataspace.copernicus.eu/api/v1/process"
GEOD = Geod(ellps="WGS84")

RASTER_EVALSCRIPT = """
//VERSION=3
function setup() {
  return {
    input: [{bands: ["B04", "B08", "SCL", "dataMask"]}],
    output: {id: "default", bands: 3, sampleType: "FLOAT32"}
  };
}
function evaluatePixel(sample) {
  let denominator = sample.B08 + sample.B04;
  let ndvi = denominator === 0 ? -9999 : (sample.B08 - sample.B04) / denominator;
  return [ndvi, sample.SCL, sample.dataMask];
}
"""

TRUE_COLOR_EVALSCRIPT = """
//VERSION=3
function setup() {
  return {
    input: [{bands: ["B02", "B03", "B04", "SCL", "dataMask"]}],
    output: {bands: 4, sampleType: "UINT8"}
  };
}
function evaluatePixel(sample) {
  let invalid = [0, 1, 3, 6, 7, 8, 9, 10, 11].includes(sample.SCL);
  let alpha = sample.dataMask && !invalid ? 255 : 0;
  return [
    Math.min(255, sample.B04 * 3.2 * 255),
    Math.min(255, sample.B03 * 3.2 * 255),
    Math.min(255, sample.B02 * 3.2 * 255),
    alpha
  ];
}
"""


class SentinelHubProcessor:
    def __init__(self) -> None:
        self._token: str | None = None
        self._token_expires_at = 0.0
        self._token_lock = asyncio.Lock()

    async def process(self, job_id: str, request: NdviJobInput) -> dict:
        settings.validate_credentials()
        polygon = Polygon(request.geometry.coordinates[0])
        if not polygon.is_valid:
            raise ValueError("O croqui possui uma geometria inválida ou auto-interseção.")
        if polygon.area == 0:
            raise ValueError("O croqui não possui área mensurável.")

        acquired_at = scene_datetime(request.scene_id)
        bounds = polygon.bounds
        width, height = output_dimensions(bounds)
        payload = process_payload(
            request,
            acquired_at,
            width,
            height,
            RASTER_EVALSCRIPT,
            "image/tiff",
        )
        raster_bytes = await self._request_process(payload)

        result_directory = settings.result_directory / job_id
        result_directory.mkdir(parents=True, exist_ok=True)
        ndvi_png = result_directory / "ndvi.png"
        raster_path = result_directory / "ndvi.tif"
        raster_path.write_bytes(raster_bytes)

        with rasterio.open(BytesIO(raster_bytes)) as dataset:
            ndvi = dataset.read(1).astype(np.float32)
            scl = dataset.read(2).astype(np.int16)
            data_mask = dataset.read(3).astype(np.uint8)
            ndvi[ndvi <= -9990] = np.nan
            valid_mask, quality = summarize_quality(
                scl,
                data_mask,
                request.algorithm.excluded_scl_classes,
            )
            ndvi[~valid_mask] = np.nan
            statistics = summarize_values(ndvi)
            area_hectares = polygon_area_hectares(polygon)
            valid_area_hectares = area_hectares * quality.valid_percentage / 100.0
            general_classes = classify_general(ndvi, valid_area_hectares)
            relative_classes = classify_relative(ndvi, valid_area_hectares)
            attention_zones = build_attention_zones(
                ndvi,
                valid_mask,
                dataset.transform,
            )
            render_ndvi_png(ndvi, valid_mask, ndvi_png)

        true_color_png = result_directory / "true-color.png"
        true_color_payload = process_payload(
            request,
            acquired_at,
            width,
            height,
            TRUE_COLOR_EVALSCRIPT,
            "image/png",
        )
        true_color_png.write_bytes(await self._request_process(true_color_payload))

        confidence = (
            "alta"
            if quality.valid_percentage >= 90
            else "moderada"
            if quality.valid_percentage >= request.minimum_valid_coverage_percentage
            else "insuficiente"
        )
        base_url = settings.public_base_url.rstrip("/")
        south, west, north, east = bounds[1], bounds[0], bounds[3], bounds[2]
        return {
            "id": job_id,
            "sceneId": request.scene_id,
            "plotId": request.plot_id,
            "source": "sentinel-2-l2a",
            "sensor": "Sentinel-2 L2A",
            "acquiredAt": acquired_at.isoformat().replace("+00:00", "Z"),
            "processedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "resolutionMeters": 10,
            "totalAreaHectares": area_hectares,
            "validAreaHectares": valid_area_hectares,
            "discardedAreaHectares": max(0.0, area_hectares - valid_area_hectares),
            "validCoveragePercentage": quality.valid_percentage,
            "minimumValidCoveragePercentage": request.minimum_valid_coverage_percentage,
            "statistics": statistics,
            "classes": general_classes,
            "generalClasses": general_classes,
            "relativeClasses": relative_classes,
            "attentionZones": attention_zones,
            "quality": {
                "confidence": confidence,
                "cloudPercentage": percentage(quality.cloud_pixels, quality.total_pixels),
                "shadowPercentage": percentage(quality.shadow_pixels, quality.total_pixels),
                "noDataPercentage": percentage(quality.nodata_pixels, quality.total_pixels),
                "waterPercentage": percentage(quality.water_pixels, quality.total_pixels),
                "validPixelCount": quality.valid_pixels,
                "totalPixelCount": quality.total_pixels,
            },
            "ndviLayer": {
                "kind": "image",
                "url": f"{base_url}/v1/ndvi/assets/{job_id}/ndvi.png",
                "bounds": [[south, west], [north, east]],
            },
            "trueColorLayer": {
                "kind": "image",
                "url": f"{base_url}/v1/ndvi/assets/{job_id}/true-color.png",
                "bounds": [[south, west], [north, east]],
            },
            "provenance": {
                "catalogUrl": "https://stac.dataspace.copernicus.eu/v1",
                "collection": request.collection,
                "processorVersion": "agryn-ndvi-1.0.0",
                "maskMethod": "Sentinel-2 L2A SCL: 0,1,3,6,7,8,9,10,11 excluídos",
                "formula": "(B08 - B04) / (B08 + B04)",
                "algorithmVersion": "1.0.0",
            },
        }

    async def _request_process(self, payload: dict) -> bytes:
        token = await self._access_token()
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                PROCESS_URL,
                headers={"Authorization": f"Bearer {token}"},
                json=payload,
            )
        if response.status_code == 429:
            raise RuntimeError("A cota temporária do Copernicus foi atingida. Tente novamente.")
        if response.status_code in (401, 403):
            self._token = None
            raise RuntimeError("As credenciais do Copernicus não autorizaram o processamento.")
        response.raise_for_status()
        return response.content

    async def _access_token(self) -> str:
        if self._token and time.time() < self._token_expires_at - 60:
            return self._token
        async with self._token_lock:
            if self._token and time.time() < self._token_expires_at - 60:
                return self._token
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    TOKEN_URL,
                    data={
                        "grant_type": "client_credentials",
                        "client_id": settings.cdse_client_id,
                        "client_secret": settings.cdse_client_secret,
                    },
                )
            response.raise_for_status()
            payload = response.json()
            self._token = payload["access_token"]
            self._token_expires_at = time.time() + int(payload.get("expires_in", 3600))
            return self._token


def scene_datetime(scene_id: str) -> datetime:
    for token in scene_id.replace("-", "_").split("_"):
        if len(token) >= 15 and token[:8].isdigit() and token[8] in ("T", "t"):
            return datetime.strptime(token[:15].upper(), "%Y%m%dT%H%M%S").replace(
                tzinfo=timezone.utc
            )
    raise ValueError(
        "O identificador da cena não contém a data Sentinel-2 esperada."
    )


def output_dimensions(bounds: tuple[float, float, float, float]) -> tuple[int, int]:
    west, south, east, north = bounds
    width_meters = abs(GEOD.inv(west, south, east, south)[2])
    height_meters = abs(GEOD.inv(west, south, west, north)[2])
    width = max(64, int(np.ceil(width_meters / 10.0)))
    height = max(64, int(np.ceil(height_meters / 10.0)))
    pixels = width * height
    if pixels > settings.max_output_pixels:
        scale = (settings.max_output_pixels / pixels) ** 0.5
        width = max(64, int(width * scale))
        height = max(64, int(height * scale))
    return width, height


def process_payload(
    request: NdviJobInput,
    acquired_at: datetime,
    width: int,
    height: int,
    evalscript: str,
    mime_type: str,
) -> dict:
    start = acquired_at - timedelta(minutes=10)
    end = acquired_at + timedelta(minutes=10)
    return {
        "input": {
            "bounds": {
                "properties": {
                    "crs": "http://www.opengis.net/def/crs/OGC/1.3/CRS84"
                },
                "geometry": request.geometry.model_dump(),
            },
            "data": [
                {
                    "type": "sentinel-2-l2a",
                    "dataFilter": {
                        "timeRange": {
                            "from": start.isoformat().replace("+00:00", "Z"),
                            "to": end.isoformat().replace("+00:00", "Z"),
                        },
                        "mosaickingOrder": "leastCC",
                    },
                }
            ],
        },
        "output": {
            "width": width,
            "height": height,
            "responses": [{"identifier": "default", "format": {"type": mime_type}}],
        },
        "evalscript": evalscript,
    }


processor = SentinelHubProcessor()
