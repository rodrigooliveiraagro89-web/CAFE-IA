from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

import numpy as np
from PIL import Image
from pyproj import Geod
from rasterio import features
from shapely.geometry import Polygon, shape


GENERAL_CLASSES = (
    ("solo-exposto", "Solo exposto ou ausência de vegetação", "#8F4E2F", -1.0, 0.2),
    ("muito-baixo", "Vigor muito baixo", "#D97706", 0.2, 0.35),
    ("baixo", "Vigor baixo", "#EAB308", 0.35, 0.5),
    ("intermediario", "Vigor intermediário", "#A3E635", 0.5, 0.65),
    ("alto", "Vigor alto", "#22C55E", 0.65, 0.8),
    ("muito-alto", "Vigor muito alto", "#047857", 0.8, 1.000001),
)

RELATIVE_LABELS = (
    ("muito-abaixo", "Muito abaixo do padrão", "#9A3412"),
    ("abaixo", "Abaixo do padrão", "#F59E0B"),
    ("padrao", "Dentro do padrão", "#A3E635"),
    ("acima", "Acima do padrão", "#22C55E"),
    ("muito-acima", "Muito acima do padrão", "#047857"),
)

GEOD = Geod(ellps="WGS84")


@dataclass(frozen=True)
class QualitySummary:
    total_pixels: int
    valid_pixels: int
    cloud_pixels: int
    shadow_pixels: int
    nodata_pixels: int
    water_pixels: int

    @property
    def valid_percentage(self) -> float:
        return percentage(self.valid_pixels, self.total_pixels)


def percentage(value: int | float, total: int | float) -> float:
    return 0.0 if total <= 0 else min(100.0, max(0.0, value / total * 100.0))


def summarize_quality(
    scl: np.ndarray,
    data_mask: np.ndarray,
    excluded_scl_classes: Iterable[int],
) -> tuple[np.ndarray, QualitySummary]:
    inside = data_mask > 0
    excluded = np.isin(scl.astype(np.int16), list(excluded_scl_classes))
    valid = inside & ~excluded
    total = int(np.count_nonzero(inside))
    return valid, QualitySummary(
        total_pixels=total,
        valid_pixels=int(np.count_nonzero(valid)),
        cloud_pixels=int(np.count_nonzero(inside & np.isin(scl, [8, 9, 10]))),
        shadow_pixels=int(np.count_nonzero(inside & (scl == 3))),
        nodata_pixels=int(np.count_nonzero(inside & np.isin(scl, [0, 1, 7, 11]))),
        water_pixels=int(np.count_nonzero(inside & (scl == 6))),
    )


def summarize_values(values: np.ndarray) -> dict[str, float]:
    finite = values[np.isfinite(values)]
    if finite.size == 0:
        raise ValueError("Nenhum pixel NDVI válido permaneceu após a máscara de qualidade.")
    percentiles = np.percentile(finite, [10, 25, 50, 75, 90])
    mean = float(np.mean(finite))
    standard_deviation = float(np.std(finite))
    denominator = max(abs(mean), 0.15)
    coefficient_of_variation = standard_deviation / denominator * 100.0
    uniformity = 100.0 * (1.0 - min(1.0, standard_deviation / denominator))
    return {
        "mean": mean,
        "minimum": float(np.min(finite)),
        "maximum": float(np.max(finite)),
        "median": float(percentiles[2]),
        "standardDeviation": standard_deviation,
        "coefficientOfVariation": coefficient_of_variation,
        "percentile10": float(percentiles[0]),
        "percentile25": float(percentiles[1]),
        "percentile75": float(percentiles[3]),
        "percentile90": float(percentiles[4]),
        "uniformityIndex": uniformity,
        "validPixelCount": int(finite.size),
    }


def classify_general(values: np.ndarray, valid_area_hectares: float) -> list[dict]:
    finite = values[np.isfinite(values)]
    return [
        class_record(identifier, label, color, low, high, finite, valid_area_hectares)
        for identifier, label, color, low, high in GENERAL_CLASSES
    ]


def classify_relative(values: np.ndarray, valid_area_hectares: float) -> list[dict]:
    finite = values[np.isfinite(values)]
    cuts = np.percentile(finite, [10, 25, 75, 90])
    edges = [-1.0, *[float(value) for value in cuts], 1.000001]
    return [
        class_record(identifier, label, color, edges[index], edges[index + 1], finite, valid_area_hectares)
        for index, (identifier, label, color) in enumerate(RELATIVE_LABELS)
    ]


def class_record(
    identifier: str,
    label: str,
    color: str,
    low: float,
    high: float,
    values: np.ndarray,
    valid_area_hectares: float,
) -> dict:
    count = int(np.count_nonzero((values >= low) & (values < high)))
    share = percentage(count, values.size)
    return {
        "id": identifier,
        "label": label,
        "color": color,
        "min": low,
        "max": high,
        "pixelCount": count,
        "percentage": share,
        "hectares": valid_area_hectares * share / 100.0,
    }


def polygon_area_hectares(polygon: Polygon) -> float:
    area, _ = GEOD.geometry_area_perimeter(polygon)
    return abs(area) / 10_000.0


def build_attention_zones(
    ndvi: np.ndarray,
    valid_mask: np.ndarray,
    transform,
    minimum_pixels: int = 4,
) -> list[dict]:
    finite = ndvi[valid_mask & np.isfinite(ndvi)]
    if finite.size == 0:
        return []
    threshold = float(np.percentile(finite, 25))
    attention = valid_mask & np.isfinite(ndvi) & (ndvi <= threshold)
    zones: list[dict] = []
    for geometry, value in features.shapes(
        attention.astype(np.uint8),
        mask=attention,
        transform=transform,
    ):
        if value != 1:
            continue
        component = shape(geometry)
        pixel_count = int(
            np.count_nonzero(
                features.geometry_mask(
                    [geometry],
                    out_shape=attention.shape,
                    transform=transform,
                    invert=True,
                )
                & attention
            )
        )
        if pixel_count < minimum_pixels:
            continue
        centroid = component.centroid
        area_hectares = polygon_area_hectares(component)
        zones.append(
            {
                "id": f"zone-{len(zones) + 1}",
                "label": "Vigor abaixo do padrão do talhão",
                "reason": (
                    f"Grupo espacial com NDVI no quartil inferior (≤ {threshold:.3f}). "
                    "A causa deve ser confirmada em campo."
                ),
                "hectares": area_hectares,
                "centroid": [centroid.x, centroid.y],
                "persistenceCount": 1,
            }
        )
    return sorted(zones, key=lambda zone: zone["hectares"], reverse=True)[:20]


def render_ndvi_png(ndvi: np.ndarray, valid_mask: np.ndarray, destination) -> None:
    rgba = np.zeros((*ndvi.shape, 4), dtype=np.uint8)
    for _, _, color, low, high in GENERAL_CLASSES:
        selected = valid_mask & np.isfinite(ndvi) & (ndvi >= low) & (ndvi < high)
        red, green, blue = tuple(int(color[index : index + 2], 16) for index in (1, 3, 5))
        rgba[selected] = [red, green, blue, 235]
    Image.fromarray(rgba, mode="RGBA").save(destination, format="PNG", optimize=True)

