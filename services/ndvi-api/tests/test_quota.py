import pytest
import respx
from fastapi import HTTPException
from httpx import Response

from app import quota
from app.config import settings

SUPABASE_URL = "https://test.supabase.co"


@pytest.fixture(autouse=True)
def configure_supabase(monkeypatch):
    monkeypatch.setattr(settings, "supabase_url", SUPABASE_URL)
    monkeypatch.setattr(settings, "supabase_anon_key", "anon-key")
    monkeypatch.setattr(settings, "ndvi_quota_free_monthly", 2)
    monkeypatch.setattr(settings, "ndvi_quota_pro_monthly", 100)


@pytest.mark.asyncio
async def test_verify_user_rejects_missing_authorization_header():
    with pytest.raises(HTTPException) as exc_info:
        await quota.verify_user(None)
    assert exc_info.value.status_code == 401


@respx.mock
@pytest.mark.asyncio
async def test_verify_user_accepts_valid_token():
    respx.get(f"{SUPABASE_URL}/auth/v1/user").mock(
        return_value=Response(200, json={"id": "user-1", "email": "a@b.com"})
    )
    user = await quota.verify_user("Bearer good-token")
    assert user == {"id": "user-1", "email": "a@b.com", "token": "good-token"}


@respx.mock
@pytest.mark.asyncio
async def test_verify_user_rejects_invalid_or_expired_token():
    respx.get(f"{SUPABASE_URL}/auth/v1/user").mock(return_value=Response(401))
    with pytest.raises(HTTPException) as exc_info:
        await quota.verify_user("Bearer bad-token")
    assert exc_info.value.status_code == 401


@respx.mock
@pytest.mark.asyncio
async def test_effective_plan_defaults_to_gratis():
    respx.get(f"{SUPABASE_URL}/rest/v1/profiles").mock(
        return_value=Response(200, json=[{"plano": "gratis", "trial_ate": None}])
    )
    assert await quota.get_effective_plan("user-1", "token") == "gratis"


@respx.mock
@pytest.mark.asyncio
async def test_effective_plan_pro_from_subscription():
    respx.get(f"{SUPABASE_URL}/rest/v1/profiles").mock(
        return_value=Response(200, json=[{"plano": "pro", "trial_ate": None}])
    )
    assert await quota.get_effective_plan("user-1", "token") == "pro"


@respx.mock
@pytest.mark.asyncio
async def test_effective_plan_pro_from_active_trial():
    respx.get(f"{SUPABASE_URL}/rest/v1/profiles").mock(
        return_value=Response(
            200, json=[{"plano": "gratis", "trial_ate": "2999-01-01T00:00:00Z"}]
        )
    )
    assert await quota.get_effective_plan("user-1", "token") == "pro"


@respx.mock
@pytest.mark.asyncio
async def test_effective_plan_gratis_from_expired_trial():
    respx.get(f"{SUPABASE_URL}/rest/v1/profiles").mock(
        return_value=Response(
            200, json=[{"plano": "gratis", "trial_ate": "2000-01-01T00:00:00Z"}]
        )
    )
    assert await quota.get_effective_plan("user-1", "token") == "gratis"


@respx.mock
@pytest.mark.asyncio
async def test_check_quota_allows_when_within_limit():
    respx.post(f"{SUPABASE_URL}/rest/v1/rpc/check_and_increment_ndvi_usage").mock(
        return_value=Response(200, json={"allowed": True, "count": 1, "limit": 2})
    )
    await quota.check_quota("user-1", "token", "gratis")  # não deve lançar


@respx.mock
@pytest.mark.asyncio
async def test_check_quota_blocks_gratis_at_limit_with_clear_message():
    respx.post(f"{SUPABASE_URL}/rest/v1/rpc/check_and_increment_ndvi_usage").mock(
        return_value=Response(200, json={"allowed": False, "count": 2, "limit": 2})
    )
    with pytest.raises(HTTPException) as exc_info:
        await quota.check_quota("user-1", "token", "gratis")
    assert exc_info.value.status_code == 429
    assert "2/2" in exc_info.value.detail
    assert "Pro" in exc_info.value.detail


@respx.mock
@pytest.mark.asyncio
async def test_check_quota_sends_pro_limit_for_pro_accounts():
    route = respx.post(
        f"{SUPABASE_URL}/rest/v1/rpc/check_and_increment_ndvi_usage"
    ).mock(return_value=Response(200, json={"allowed": True, "count": 50, "limit": 100}))
    await quota.check_quota("user-1", "token", "pro")
    assert b'"p_limit":100' in route.calls.last.request.content
