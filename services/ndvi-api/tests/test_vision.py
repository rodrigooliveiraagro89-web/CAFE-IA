import types

import pytest
from fastapi import HTTPException

from app import vision
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
        await vision.diagnose_image("image/png", PNG_1x1)
    assert exc.value.status_code == 503


@pytest.mark.asyncio
async def test_rejects_non_image():
    with pytest.raises(HTTPException) as exc:
        await vision.diagnose_image("application/pdf", b"%PDF-")
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_rejects_oversized():
    big = b"x" * (vision.MAX_UPLOAD_BYTES + 1)
    with pytest.raises(HTTPException) as exc:
        await vision.diagnose_image("image/jpeg", big)
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

    monkeypatch.setattr(vision.anthropic, "AsyncAnthropic", fake_client)


@pytest.mark.asyncio
async def test_happy_path_returns_diagnosis(monkeypatch):
    payload = (
        '{"provavel": "Ferrugem do cafeeiro", "confianca": "media", '
        '"sinais_observados": ["pústulas alaranjadas na face inferior"], '
        '"possiveis_causas": ["Hemileia vastatrix"], '
        '"manejo_geral": ["monitorar", "arejar a lavoura"], '
        '"recomenda_confirmar": "Inspecione outras folhas.", "extra": 1}'
    )
    _patch_client(monkeypatch, _fake_response(payload))
    result = await vision.diagnose_image("image/png", PNG_1x1)
    assert result["provavel"] == "Ferrugem do cafeeiro"
    assert result["confianca"] == "media"
    # chave desconhecida é descartada
    assert "extra" not in result


@pytest.mark.asyncio
async def test_refusal_returns_422(monkeypatch):
    _patch_client(monkeypatch, _fake_response("", stop_reason="refusal"))
    with pytest.raises(HTTPException) as exc:
        await vision.diagnose_image("image/png", PNG_1x1)
    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_invalid_json_returns_502(monkeypatch):
    _patch_client(monkeypatch, _fake_response("nope"))
    with pytest.raises(HTTPException) as exc:
        await vision.diagnose_image("image/png", PNG_1x1)
    assert exc.value.status_code == 502
