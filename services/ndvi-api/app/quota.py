from __future__ import annotations

from datetime import datetime, timezone

import httpx
from fastapi import HTTPException

from .config import settings

PLAN_LABELS = {"gratis": "Grátis", "pro": "Pro"}


def _require_supabase_config() -> None:
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise HTTPException(
            status_code=500,
            detail="SUPABASE_URL e SUPABASE_ANON_KEY precisam estar configurados no servidor.",
        )


def _bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Faça login para processar NDVI.")
    return authorization.split(" ", 1)[1].strip()


async def verify_user(authorization: str | None) -> dict:
    """Valida o token da sessão do usuário e retorna {id, email}."""
    _require_supabase_config()
    token = _bearer_token(authorization)
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(
            f"{settings.supabase_url}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": settings.supabase_anon_key,
            },
        )
    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Sessão inválida ou expirada. Faça login novamente.")
    user = response.json()
    return {"id": user["id"], "email": user.get("email", ""), "token": token}


def _effective_plan(plano: str | None, trial_ate: str | None) -> str:
    if plano == "pro":
        return "pro"
    if trial_ate:
        try:
            end = datetime.fromisoformat(trial_ate.replace("Z", "+00:00"))
            if end > datetime.now(timezone.utc):
                return "pro"
        except ValueError:
            pass
    return "gratis"


async def get_effective_plan(user_id: str, token: str) -> str:
    """Busca o plano do próprio usuário (RLS libera só a própria linha)."""
    _require_supabase_config()
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(
            f"{settings.supabase_url}/rest/v1/profiles",
            params={"id": f"eq.{user_id}", "select": "plano,trial_ate"},
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": settings.supabase_anon_key,
            },
        )
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail="Não foi possível confirmar seu plano agora. Tente novamente.")
    rows = response.json()
    if not rows:
        return "gratis"
    return _effective_plan(rows[0].get("plano"), rows[0].get("trial_ate"))


async def check_quota(
    user_id: str,
    token: str,
    plan: str,
    *,
    rpc: str = "check_and_increment_ndvi_usage",
    free_limit: int | None = None,
    pro_limit: int | None = None,
    feature: str = "NDVI",
) -> None:
    """Levanta 429 se a conta já atingiu a cota mensal do recurso no plano.

    Os limites e a função de contagem são parametrizados para que cada recurso
    pago (NDVI, análise de solo por IA) tenha o próprio contador, reaproveitando
    a mesma checagem atômica no Supabase.
    """
    _require_supabase_config()
    if free_limit is None:
        free_limit = settings.ndvi_quota_free_monthly
    if pro_limit is None:
        pro_limit = settings.ndvi_quota_pro_monthly
    limit = pro_limit if plan == "pro" else free_limit
    period = datetime.now(timezone.utc).strftime("%Y-%m")
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(
            f"{settings.supabase_url}/rest/v1/rpc/{rpc}",
            json={"p_period": period, "p_limit": limit},
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": settings.supabase_anon_key,
                "Content-Type": "application/json",
            },
        )
    if response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Não foi possível checar sua cota de {feature} agora. Tente novamente.",
        )
    result = response.json()
    if not result.get("allowed", False):
        label = PLAN_LABELS.get(plan, plan)
        raise HTTPException(
            status_code=429,
            detail=(
                f"Cota mensal do plano {label} atingida "
                f"({result.get('count')}/{result.get('limit')}). "
                f"Assine o Pro para continuar usando {feature}."
            ),
        )
