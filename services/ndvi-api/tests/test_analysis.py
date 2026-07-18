import numpy as np
import pytest

from app.analysis import (
    classify_general,
    classify_relative,
    summarize_quality,
    summarize_values,
)


def test_professional_statistics_and_uniformity():
    values = np.array([[0.2, 0.4], [0.6, 0.8]], dtype=np.float32)
    summary = summarize_values(values)

    assert summary["mean"] == pytest.approx(0.5)
    assert summary["median"] == pytest.approx(0.5)
    assert summary["percentile10"] == pytest.approx(0.26)
    assert summary["percentile90"] == pytest.approx(0.74)
    assert 0 <= summary["uniformityIndex"] <= 100
    assert summary["validPixelCount"] == 4


def test_scl_quality_mask_excludes_cloud_shadow_water_and_nodata():
    scl = np.array([[4, 8, 3], [6, 5, 0]], dtype=np.int16)
    data_mask = np.ones_like(scl, dtype=np.uint8)
    valid, quality = summarize_quality(scl, data_mask, [0, 1, 3, 6, 7, 8, 9, 10, 11])

    assert quality.total_pixels == 6
    assert quality.valid_pixels == 2
    assert quality.cloud_pixels == 1
    assert quality.shadow_pixels == 1
    assert quality.water_pixels == 1
    assert valid.tolist() == [[True, False, False], [False, True, False]]


def test_general_and_relative_classifications_preserve_all_valid_pixels():
    values = np.array([0.1, 0.3, 0.4, 0.55, 0.7, 0.9], dtype=np.float32)
    general = classify_general(values, 6.0)
    relative = classify_relative(values, 6.0)

    assert sum(item["pixelCount"] for item in general) == 6
    assert sum(item["pixelCount"] for item in relative) == 6
    assert sum(item["hectares"] for item in general) == pytest.approx(6.0)
