from __future__ import annotations

import base64
import json

import anthropic
from fastapi import HTTPException

from .config import settings

# A IA SÓ extrai números do laudo — a interpretação agronômica é feita por
# código determinístico no frontend (faixas CFSEMG/Boletim 100). Isso mantém o
# custo baixo, o resultado auditável e coerente com a governança do AGRYN.

MODEL = "claude-opus-4-8"
MAX_UPLOAD_BYTES = 8 * 1024 * 1024  # 8 MB — bem abaixo do limite de 32 MB da API

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_TYPES = ALLOWED_IMAGE_TYPES | {"application/pdf"}

# Campos numéricos capturados (unidades usuais dos laboratórios brasileiros).
NUMERIC_FIELDS = [
    "ph",
    "p",
    "k",
    "ca",
    "mg",
    "s",
    "ctc",
    "v_percent",
    "m_percent",
    "organic_matter",
    "zn",
    "b",
    "fe",
    "mn",
    "cu",
]

_NUMBER_OR_NULL = {"type": ["number", "null"]}
_STRING_OR_NULL = {"type": ["string", "null"]}

EXTRACTION_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        **{field: _NUMBER_OR_NULL for field in NUMERIC_FIELDS},
        "analysis_date": _STRING_OR_NULL,  # ISO 8601 (YYYY-MM-DD) quando legível
        "laboratory": _STRING_OR_NULL,
    },
    "required": [*NUMERIC_FIELDS, "analysis_date", "laboratory"],
}

SYSTEM_PROMPT = (
    "Você extrai os valores numéricos de um laudo de análise de solo brasileiro. "
    "Retorne exatamente os números impressos no laudo, sem converter unidades e "
    "sem interpretar. Unidades usuais: pH sem unidade; P, K, S e micronutrientes "
    "(Zn, B, Fe, Mn, Cu) em mg/dm³; Ca, Mg e CTC em cmolc/dm³; V% e m% em "
    "porcentagem; matéria orgânica (M.O.) em dag/kg ou %. Use null para qualquer "
    "valor que não estiver claramente legível no laudo — nunca invente ou estime. "
    "Se o laudo tiver várias amostras/áreas, extraia a primeira."
)


def _require_anthropic_config() -> None:
    if not settings.anthropic_api_key:
        raise HTTPException(
            status_code=503,
            detail=(
                "A extração por IA ainda não está configurada no servidor. "
                "Você pode digitar os valores do laudo manualmente por enquanto."
            ),
        )


def validate_upload(media_type: str, data: bytes) -> None:
    if media_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Envie uma foto (JPG, PNG ou WEBP) ou um PDF do laudo.",
        )
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=400,
            detail="Arquivo muito grande. Use uma foto de até 8 MB.",
        )
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="O arquivo está vazio.")


def _document_block(media_type: str, data: bytes) -> dict:
    encoded = base64.standard_b64encode(data).decode("utf-8")
    if media_type == "application/pdf":
        return {
            "type": "document",
            "source": {"type": "base64", "media_type": "application/pdf", "data": encoded},
        }
    return {
        "type": "image",
        "source": {"type": "base64", "media_type": media_type, "data": encoded},
    }


async def extract_soil_values(media_type: str, data: bytes) -> dict:
    """Chama o Claude para extrair os números do laudo e devolve um dict validado."""
    _require_anthropic_config()
    validate_upload(media_type, data)

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    try:
        response = await client.messages.create(
            model=MODEL,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            thinking={"type": "adaptive"},
            output_config={
                "effort": "low",
                "format": {"type": "json_schema", "schema": EXTRACTION_SCHEMA},
            },
            messages=[
                {
                    "role": "user",
                    "content": [
                        _document_block(media_type, data),
                        {"type": "text", "text": "Extraia os valores deste laudo de solo."},
                    ],
                }
            ],
        )
    except anthropic.APIError as error:
        raise HTTPException(
            status_code=502,
            detail="Não foi possível ler o laudo agora. Tente novamente em instantes.",
        ) from error

    if response.stop_reason == "refusal":
        raise HTTPException(
            status_code=422,
            detail="Não foi possível processar esta imagem. Envie uma foto nítida do laudo.",
        )

    text = next((block.text for block in response.content if block.type == "text"), None)
    if not text:
        raise HTTPException(
            status_code=502,
            detail="A leitura do laudo não retornou dados. Tente outra foto.",
        )
    try:
        values = json.loads(text)
    except json.JSONDecodeError as error:
        raise HTTPException(
            status_code=502,
            detail="A leitura do laudo veio em formato inesperado. Tente novamente.",
        ) from error

    # Mantém só as chaves conhecidas do schema — defensivo.
    allowed = set(NUMERIC_FIELDS) | {"analysis_date", "laboratory"}
    return {key: value for key, value in values.items() if key in allowed}
