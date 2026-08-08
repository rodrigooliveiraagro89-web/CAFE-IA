from __future__ import annotations

from datetime import date, timedelta
from typing import Any

import httpx
from fastapi import HTTPException

from .config import settings


def _admin_headers() -> dict[str, str]:
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise HTTPException(status_code=503, detail="A automação comercial ainda não está configurada.")
    return {
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "apikey": settings.supabase_service_role_key,
        "Content-Type": "application/json",
    }


async def start_trial(user_id: str) -> str:
    headers = _admin_headers()
    async with httpx.AsyncClient(timeout=12) as client:
        current = await client.get(
            f"{settings.supabase_url}/rest/v1/profiles",
            params={"id": f"eq.{user_id}", "select": "trial_ate"},
            headers=headers,
        )
        current.raise_for_status()
        rows = current.json()
        if not rows:
            raise HTTPException(status_code=404, detail="Perfil não encontrado.")
        if rows[0].get("trial_ate"):
            raise HTTPException(status_code=409, detail="O teste grátis já foi utilizado nesta conta.")
        trial_end = (date.today() + timedelta(days=14)).isoformat()
        updated = await client.patch(
            f"{settings.supabase_url}/rest/v1/profiles",
            params={"id": f"eq.{user_id}", "trial_ate": "is.null"},
            json={"trial_ate": f"{trial_end}T23:59:59Z"},
            headers={**headers, "Prefer": "return=representation"},
        )
        updated.raise_for_status()
        if not updated.json():
            raise HTTPException(status_code=409, detail="O teste grátis já foi utilizado nesta conta.")
    return f"{trial_end}T23:59:59Z"


async def create_checkout(user: dict[str, Any], name: str = "") -> str:
    if not settings.asaas_api_key:
        raise HTTPException(status_code=503, detail="O checkout automático ainda não está configurado.")
    return_url = settings.agryn_app_url.rstrip("/") + "/"
    payload = {
        "billingTypes": ["CREDIT_CARD", "PIX"],
        "chargeTypes": ["RECURRENT"],
        "minutesToExpire": 60,
        "externalReference": user["id"],
        "callback": {
            "successUrl": f"{return_url}?checkout=sucesso",
            "cancelUrl": f"{return_url}?checkout=cancelado",
            "expiredUrl": f"{return_url}?checkout=expirado",
        },
        "items": [{
            "externalReference": "agryn-pro-monthly",
            "name": "AGRYN Pro",
            "description": "Assinatura mensal da plataforma AGRYN para cafeicultura",
            "quantity": 1,
            "value": 49.90,
        }],
        "customerData": {"name": name or "Cliente AGRYN", "email": user.get("email", "")},
        "subscription": {"cycle": "MONTHLY", "nextDueDate": date.today().isoformat()},
    }
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            f"{settings.asaas_api_url.rstrip('/')}/checkouts",
            json=payload,
            headers={"access_token": settings.asaas_api_key, "Content-Type": "application/json"},
        )
    if not response.is_success:
        raise HTTPException(status_code=502, detail="Não foi possível abrir o checkout agora.")
    data = response.json()
    link = data.get("link")
    if not link and data.get("id"):
        link = f"https://asaas.com/checkoutSession/show?id={data['id']}"
    if not link:
        raise HTTPException(status_code=502, detail="O provedor não retornou o link de pagamento.")
    return link


async def process_webhook(event: dict[str, Any]) -> None:
    event_id = str(event.get("id", ""))
    event_type = str(event.get("event", ""))
    resource = event.get("checkout") or event.get("payment") or event.get("subscription") or {}
    user_id = resource.get("externalReference")
    if not event_id:
        raise HTTPException(status_code=400, detail="Evento sem identificador.")
    headers = _admin_headers()
    async with httpx.AsyncClient(timeout=12) as client:
        existing = await client.get(
            f"{settings.supabase_url}/rest/v1/billing_events",
            params={"event_id": f"eq.{event_id}", "select": "event_id"},
            headers=headers,
        )
        existing.raise_for_status()
        if existing.json():
            return
        if user_id and event_type in {"CHECKOUT_PAID", "PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"}:
            response = await client.patch(
                f"{settings.supabase_url}/rest/v1/profiles",
                params={"id": f"eq.{user_id}"},
                json={"plano": "pro"},
                headers=headers,
            )
            response.raise_for_status()
        if user_id and event_type in {"SUBSCRIPTION_INACTIVATED", "SUBSCRIPTION_DELETED"}:
            response = await client.patch(
                f"{settings.supabase_url}/rest/v1/profiles",
                params={"id": f"eq.{user_id}"},
                json={"plano": "gratis"},
                headers=headers,
            )
            response.raise_for_status()
        inserted = await client.post(
            f"{settings.supabase_url}/rest/v1/billing_events",
            json={"event_id": event_id, "event_type": event_type, "user_id": user_id, "payload": event},
            headers=headers,
        )
        inserted.raise_for_status()
