from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class GeoPolygon(BaseModel):
    type: Literal["Polygon"]
    coordinates: list[list[tuple[float, float]]]

    @field_validator("coordinates")
    @classmethod
    def validate_rings(cls, value: list[list[tuple[float, float]]]):
        if not value or len(value[0]) < 4:
            raise ValueError("O polígono precisa de pelo menos três vértices e fechamento.")
        return value


class AlgorithmInput(BaseModel):
    index: Literal["NDVI"] = "NDVI"
    red_band: str = "B04"
    nir_band: str = "B08"
    quality_band: str = "SCL"
    excluded_scl_classes: list[int] = Field(
        default_factory=lambda: [0, 1, 3, 6, 7, 8, 9, 10, 11]
    )


class NdviJobInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scene_id: str = Field(min_length=1, max_length=300)
    collection: Literal["sentinel-2-l2a"]
    geometry: GeoPolygon
    plot_id: str = Field(min_length=1, max_length=200)
    minimum_valid_coverage_percentage: float = Field(default=70, ge=0, le=100)
    algorithm: AlgorithmInput = Field(default_factory=AlgorithmInput)


class JobEnvelope(BaseModel):
    id: str
    status: Literal["queued", "processing", "completed", "failed", "cancelled"]
    progress: float = Field(default=0, ge=0, le=100)
    message: str
    result: dict[str, Any] | None = None
    error: dict[str, str] | None = None

