from __future__ import annotations

import asyncio
import hashlib
import json
import uuid
from contextlib import asynccontextmanager

from fastapi import BackgroundTasks, FastAPI, Header, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .config import settings
from .models import JobEnvelope, NdviJobInput
from .quota import check_quota, get_effective_plan, verify_user
from .sentinelhub import processor


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
    allow_headers=["Content-Type", "Accept"],
)

jobs: dict[str, JobEnvelope] = {}
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
    cache_key = request_hash(request)
    async with lock:
        cached_id = cache.get(cache_key)
        cached_job = jobs.get(cached_id) if cached_id else None
        if cached_job and cached_job.status == "completed":
            response.status_code = status.HTTP_200_OK
            return cached_job

    # Só cobra cota por processamento genuinamente novo — uma cena já
    # processada e em cache (acima) não consome a cota do usuário.
    user = await verify_user(authorization)
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
        cache[cache_key] = job_id
    background_tasks.add_task(run_job, job_id, request)
    return envelope


@app.get("/v1/ndvi/jobs/{job_id}", response_model=JobEnvelope)
async def get_job(job_id: str) -> JobEnvelope:
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Análise não encontrada.")
    return job


@app.delete("/v1/ndvi/jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_job(job_id: str) -> Response:
    job = jobs.get(job_id)
    if not job:
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
async def get_asset(job_id: str, file_name: str) -> FileResponse:
    if file_name not in {"ndvi.png", "true-color.png", "ndvi.tif"}:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado.")
    path = settings.result_directory / job_id / file_name
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Arquivo não encontrado.")
    media_type = "image/png" if file_name.endswith(".png") else "image/tiff"
    return FileResponse(path, media_type=media_type)


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


def request_hash(request: NdviJobInput) -> str:
    canonical = json.dumps(
        request.model_dump(mode="json"),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
