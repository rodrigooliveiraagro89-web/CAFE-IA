import types

import pytest
from fastapi import HTTPException

from app import soil
from app.config import settings

PNG_1x1 = bytes.fromhex(
    "89504e470d0a1a0a0000000d4948445200000001000000010806000000"
    "1f15c4890000000d4944415478da6360000002000001e221bc330000000049454e44ae426082"
)


@pytest.fixture(autouse=True)
def configure_key(monkeypatch):
    monkeypatch.setattr(settings, "anthropic_api_key", "sk-test")


@pytest.mark.asyncio
async def test_missing_key_returns_503(monkeypatch):
    monkeypatch.setattr(settings, "anthropic_api_key", "")
    with pytest.raises(HTTPException) as exc:
        await soil.extract_soil_values("image/png", PNG_1x1)
    assert exc.value.status_code == 503


@pytest.mark.asyncio
async def test_rejects_unsupported_file_type():
    with pytest.raises(HTTPException) as exc:
        await soil.extract_soil_values("text/plain", b"hello")
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_rejects_oversized_file():
    big = b"x" * (soil.MAX_UPLOAD_BYTES + 1)
    with pytest.raises(HTTPException) as exc:
        await soil.extract_soil_values("image/jpeg", big)
    assert exc.value.status_code == 400


def _fake_response(text: str, stop_reason: str = "end_turn"):
    block = types.SimpleNamespace(type="text", text=text)
    return types.SimpleNamespace(content=[block], stop_reason=stop_reason)


def _patch_client(monkeypatch, response):
    async def fake_create(**_kwargs):
        return response

    def fake_client(*_args, **_kwargs):
        messages = types.SimpleNamespace(create=fake_create)
        return types.SimpleNamespace(messages=messages)

    monkeypatch.setattr(soil.anthropic, "AsyncAnthropic", fake_client)


@pytest.mark.asyncio
async def test_happy_path_returns_validated_values(monkeypatch):
    payload = (
        '{"ph": 5.8, "p": 2.1, "k": 48, "ca": 3.2, "mg": 0.9, "s": 8.0, '
        '"ctc": 8.5, "v_percent": 64, "m_percent": 2, "organic_matter": 4.2, '
        '"zn": 1.8, "b": 0.3, "fe": 12.4, "mn": 18.2, "cu": 0.4, '
        '"analysis_date": "2026-07-20", "laboratory": "BASLAB", "lixo": 99}'
    )
    _patch_client(monkeypatch, _fake_response(payload))
    values = await soil.extract_soil_values("image/png", PNG_1x1)
    assert values["ph"] == 5.8
    assert values["laboratory"] == "BASLAB"
    # chave desconhecida é descartada
    assert "lixo" not in values


@pytest.mark.asyncio
async def test_refusal_returns_422(monkeypatch):
    _patch_client(monkeypatch, _fake_response("", stop_reason="refusal"))
    with pytest.raises(HTTPException) as exc:
        await soil.extract_soil_values("image/png", PNG_1x1)
    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_invalid_json_returns_502(monkeypatch):
    _patch_client(monkeypatch, _fake_response("not json"))
    with pytest.raises(HTTPException) as exc:
        await soil.extract_soil_values("image/png", PNG_1x1)
    assert exc.value.status_code == 502
