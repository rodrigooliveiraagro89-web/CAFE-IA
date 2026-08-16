from __future__ import annotations

import asyncio
import hashlib
import json
import uuid
from contextlib import asynccontextmanager

from fastapi import (
    BackgroundTasks,
    FastAPI,
    File,
    Header,
    HTTPException,
    Response,
    UploadFile,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .config import settings
from .models import JobEnvelope, NdviJobInput
from .chat import chat_reply
from .quota import check_quota, get_effective_plan, verify_user
from .sentinelhub import processor
from .soil import extract_soil_values
from .vision import diagnose_image
from .billing import create_checkout, process_webhook, start_trial
from .security import valid_asset_token


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.result_directory.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(
    title="AGRYN NDVI API",
    version="1.0.0",
    description="Processamento rastreável de Sentinel-2 L2A por talhão.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Accept", "Authorization"],
)

jobs: dict[str, JobEnvelope] = {}
job_owners: dict[str, str] = {}
cache: dict[str, str] = {}
lock = asyncio.Lock()


@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "processor": "agryn-ndvi-1.0.0",
        "credentialsConfigured": bool(
            settings.cdse_client_id and settings.cdse_client_secret
        ),
    }


@app.post(
    "/v1/ndvi/jobs",
    response_model=JobEnvelope,
    status_code=status.HTTP_202_ACCEPTED,
)
async def create_job(
    request: NdviJobInput,
    background_tasks: BackgroundTasks,
    response: Response,
    authorization: str | None = Header(default=None),
) -> JobEnvelope:
    user = await verify_user(authorization)
    cache_key = request_hash(request, user["id"])
    async with lock:
        cached_id = cache.get(cache_key)
        cached_job = jobs.get(cached_id) if cached_id else None
        if cached_job and cached_job.status == "completed":
            response.status_code = status.HTTP_200_OK
            return cached_job

    # Só cobra cota por processamento genuinamente novo — uma cena já
    # processada e em cache (acima) não consome a cota do usuário.
    plan = await get_effective_plan(user["id"], user["token"])
    await check_quota(user["id"], user["token"], plan)

    async with lock:
        job_id = uuid.uuid4().hex
        envelope = JobEnvelope(
            id=job_id,
            status="queued",
            progress=0,
            message="Análise adicionada à fila.",
        )
        jobs[job_id] = envelope
        job_owners[job_id] = user["id"]
        cache[cache_key] = job_id
    background_tasks.add_task(run_job, job_id, request)
    return envelope


@app.get("/v1/ndvi/jobs/{job_id}", response_model=JobEnvelope)
async def get_job(job_id: str, authorization: str | None = Header(default=None)) -> JobEnvelope:
    user = await verify_user(authorization)
    job = jobs.get(job_id)
    if not job or job_owners.get(job_id) != user["id"]:
        raise HTTPException(status_code=404, detail="Análise não encontrada.")
    return job


@app.delete("/v1/ndvi/jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_job(job_id: str, authorization: str | None = Header(default=None)) -> Response:
    user = await verify_user(authorization)
    job = jobs.get(job_id)
    if not job or job_owners.get(job_id) != user["id"]:
        raise HTTPException(status_code=404, detail="Análise não encontrada.")
    if job.status in ("queued", "processing"):
        jobs[job_id] = job.model_copy(
            update={
                "status": "cancelled",
                "message": "Processamento cancelado pelo usuário.",
            }
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/v1/ndvi/assets/{job_id}/{file_name}")
async def get_asset(job_id: str, file_name: str, token: str | None = None) -> FileResponse:
    if not valid_asset_token(job_id, token):
        raise HTTPException(status_code=401, detail="Link de imagem inválido ou expirado.")
    if file_name not in {"ndvi.png", "true-color.png", "ndvi.tif"}:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado.")
    path = settings.result_directory / job_id / file_name
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Arquivo não encontrado.")
    media_type = "image/png" if file_name.endswith(".png") else "image/tiff"
    return FileResponse(path, media_type=media_type)


@app.post("/v1/soil/extract")
async def extract_soil(
    file: UploadFile = File(...),
    authorization: str | None = Header(default=None),
) -> dict:
    # Auth + cota antes de gastar uma chamada paga da IA. A cota de solo é
    # independente da de NDVI (RPC e limites próprios).
    user = await verify_user(authorization)
    plan = await get_effective_plan(user["id"], user["token"])
    await check_quota(
        user["id"],
        user["token"],
        plan,
        rpc="check_and_increment_soil_usage",
        free_limit=settings.soil_quota_free_monthly,
        pro_limit=settings.soil_quota_pro_monthly,
        feature="a análise de solo",
    )

    data = await file.read()
    media_type = (file.content_type or "").split(";")[0].strip().lower()
    values = await extract_soil_values(media_type, data)
    return {"values": values}


@app.post("/v1/chat")
async def chat(
    payload: dict,
    authorization: str | None = Header(default=None),
) -> dict:
    # Auth + cota própria do assistente antes de gastar uma chamada paga da IA.
    user = await verify_user(authorization)
    plan = await get_effective_plan(user["id"], user["token"])
    await check_quota(
        user["id"],
        user["token"],
        plan,
        rpc="check_and_increment_chat_usage",
        free_limit=settings.chat_quota_free_monthly,
        pro_limit=settings.chat_quota_pro_monthly,
        feature="o assistente de IA",
    )

    reply = await chat_reply(payload.get("messages", []), payload.get("context"))
    return {"reply": reply}


@app.post("/v1/vision/diagnose")
async def diagnose(
    file: UploadFile = File(...),
    authorization: str | None = Header(default=None),
) -> dict:
    user = await verify_user(authorization)
    plan = await get_effective_plan(user["id"], user["token"])
    await check_quota(
        user["id"],
        user["token"],
        plan,
        rpc="check_and_increment_vision_usage",
        free_limit=settings.vision_quota_free_monthly,
        pro_limit=settings.vision_quota_pro_monthly,
        feature="o diagnóstico por foto",
    )

    data = await file.read()
    media_type = (file.content_type or "").split(";")[0].strip().lower()
    diagnosis = await diagnose_image(media_type, data)
    return {"diagnosis": diagnosis}


@app.post("/v1/billing/trial")
async def activate_trial(authorization: str | None = Header(default=None)) -> dict:
    user = await verify_user(authorization)
    return {"trial_ate": await start_trial(user["id"])}


@app.post("/v1/billing/checkout")
async def billing_checkout(
    payload: dict,
    authorization: str | None = Header(default=None),
) -> dict:
    user = await verify_user(authorization)
    return {"url": await create_checkout(user, str(payload.get("name", "")))}


@app.post("/v1/billing/webhooks/asaas")
async def asaas_webhook(
    payload: dict,
    asaas_access_token: str | None = Header(default=None, alias="asaas-access-token"),
) -> dict:
    if not settings.asaas_webhook_token or asaas_access_token != settings.asaas_webhook_token:
        raise HTTPException(status_code=401, detail="Webhook não autorizado.")
    await process_webhook(payload)
    return {"received": True}


async def run_job(job_id: str, request: NdviJobInput) -> None:
    current = jobs[job_id]
    if current.status == "cancelled":
        return
    jobs[job_id] = current.model_copy(
        update={
            "status": "processing",
            "progress": 12,
            "message": "Autenticando e solicitando as bandas B04, B08 e SCL.",
        }
    )
    try:
        result = await processor.process(job_id, request)
        if jobs[job_id].status == "cancelled":
            return
        jobs[job_id] = JobEnvelope(
            id=job_id,
            status="completed",
            progress=100,
            message="NDVI processado e validado.",
            result=result,
        )
    except Exception as error:
        jobs[job_id] = JobEnvelope(
            id=job_id,
            status="failed",
            progress=100,
            message="O processamento não foi concluído.",
            error={
                "code": error.__class__.__name__,
                "message": str(error),
            },
        )


def request_hash(request: NdviJobInput, user_id: str = "") -> str:
    canonical = json.dumps(
        request.model_dump(mode="json"),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(f"{user_id}:{canonical}".encode("utf-8")).hexdigest()
