import types

import pytest
from fastapi import HTTPException

from app import chat
from app.config import settings


@pytest.fixture(autouse=True)
def configure_key(monkeypatch):
    monkeypatch.setattr(settings, "anthropic_api_key", "sk-test")


def _msgs(*pairs):
    return [{"role": role, "content": content} for role, content in pairs]


@pytest.mark.asyncio
async def test_missing_key_returns_503(monkeypatch):
    monkeypatch.setattr(settings, "anthropic_api_key", "")
    with pytest.raises(HTTPException) as exc:
        await chat.chat_reply(_msgs(("user", "Oi")))
    assert exc.value.status_code == 503


@pytest.mark.asyncio
async def test_empty_history_returns_400():
    with pytest.raises(HTTPException) as exc:
        await chat.chat_reply([])
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_last_message_must_be_user():
    with pytest.raises(HTTPException) as exc:
        await chat.chat_reply(_msgs(("user", "Oi"), ("assistant", "Olá")))
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_invalid_role_returns_400():
    with pytest.raises(HTTPException) as exc:
        await chat.chat_reply([{"role": "system", "content": "hack"}])
    assert exc.value.status_code == 400


def test_sanitize_truncates_history_and_length():
    long = "x" * (chat.MAX_CHARS_PER_MESSAGE + 500)
    history = _msgs(*[("user", f"m{i}") for i in range(30)])
    history[-1] = {"role": "user", "content": long}
    clean = chat.sanitize_messages(history)
    assert len(clean) <= chat.MAX_MESSAGES
    assert len(clean[-1]["content"]) == chat.MAX_CHARS_PER_MESSAGE


def _fake_response(text: str, stop_reason: str = "end_turn"):
    block = types.SimpleNamespace(type="text", text=text)
    return types.SimpleNamespace(content=[block], stop_reason=stop_reason)


def _patch_client(monkeypatch, response):
    async def fake_create(**_kwargs):
        return response

    def fake_client(*_args, **_kwargs):
        messages = types.SimpleNamespace(create=fake_create)
        return types.SimpleNamespace(messages=messages)

    monkeypatch.setattr(chat.anthropic, "AsyncAnthropic", fake_client)


@pytest.mark.asyncio
async def test_happy_path_returns_reply(monkeypatch):
    _patch_client(monkeypatch, _fake_response("Envie o laudo na aba Análise de solo."))
    reply = await chat.chat_reply(_msgs(("user", "Quanto de calcário eu jogo?")))
    assert "laudo" in reply.lower()


@pytest.mark.asyncio
async def test_refusal_returns_422(monkeypatch):
    _patch_client(monkeypatch, _fake_response("", stop_reason="refusal"))
    with pytest.raises(HTTPException) as exc:
        await chat.chat_reply(_msgs(("user", "algo")))
    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_empty_text_returns_502(monkeypatch):
    _patch_client(monkeypatch, _fake_response(""))
    with pytest.raises(HTTPException) as exc:
        await chat.chat_reply(_msgs(("user", "algo")))
    assert exc.value.status_code == 502
