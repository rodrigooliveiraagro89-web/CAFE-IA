from __future__ import annotations

import base64
import json
import logging

import anthropic
from fastapi import HTTPException

from .config import settings

logger = logging.getLogger("agryn.vision")

# Diagnóstico visual de sintomas em foto (praga, doença, deficiência). A IA
# sugere um diagnóstico PROVÁVEL com nível de confiança — nunca um laudo
# definitivo — e NÃO prescreve dose de defensivo. Governança do AGRYN: a
# confirmação e a recomendação de produto ficam com o agrônomo responsável.

MODEL = "claude-opus-4-8"
MAX_UPLOAD_BYTES = 8 * 1024 * 1024  # 8 MB
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}

CONFIDENCE_VALUES = ["baixa", "media", "alta"]

DIAGNOSIS_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "provavel": {"type": "string"},
        "confianca": {"type": "string", "enum": CONFIDENCE_VALUES},
        "sinais_observados": {"type": "array", "items": {"type": "string"}},
        "possiveis_causas": {"type": "array", "items": {"type": "string"}},
        "manejo_geral": {"type": "array", "items": {"type": "string"}},
        "recomenda_confirmar": {"type": "string"},
    },
    "required": [
        "provavel",
        "confianca",
        "sinais_observados",
        "possiveis_causas",
        "manejo_geral",
        "recomenda_confirmar",
    ],
}

SYSTEM_PROMPT = (
    "Você é um agrônomo especialista em café e morango do Sul de Minas Gerais "
    "analisando a foto de uma planta. A partir dos sintomas VISÍVEIS na imagem, "
    "sugira o diagnóstico mais PROVÁVEL (praga, doença ou deficiência), com o "
    "nível de confiança honesto: 'alta', 'media' ou 'baixa'. Nunca afirme um "
    "diagnóstico como certeza — é uma triagem por imagem.\n\n"
    "Regras: descreva os sinais que você observou; liste possíveis causas; dê "
    "orientações de manejo GERAIS (cultural, monitoramento, MIP) SEM indicar "
    "produto comercial nem dose de defensivo/adubo — isso é responsabilidade do "
    "agrônomo em campo. No campo 'recomenda_confirmar', diga o que fazer para "
    "confirmar (inspeção, análise, foto de outra parte da planta). Se a imagem "
    "não for de planta ou estiver ilegível, use confiança 'baixa' e explique."
)


def _require_anthropic_config() -> None:
    if not settings.anthropic_api_key:
        raise HTTPException(
            status_code=503,
            detail="O diagnóstico por IA ainda não está configurado no servidor.",
        )


def validate_upload(media_type: str, data: bytes) -> None:
    if media_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Envie uma foto da planta (JPG, PNG ou WEBP).",
        )
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=400, detail="Foto muito grande. Use uma imagem de até 8 MB."
        )
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="O arquivo está vazio.")


async def diagnose_image(media_type: str, data: bytes) -> dict:
    """Chama o Claude Vision e devolve um diagnóstico provável estruturado."""
    _require_anthropic_config()
    validate_upload(media_type, data)

    encoded = base64.standard_b64encode(data).decode("utf-8")
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    try:
        response = await client.messages.create(
            model=MODEL,
            max_tokens=2048,
            system=SYSTEM_PROMPT,
            output_config={
                "format": {"type": "json_schema", "schema": DIAGNOSIS_SCHEMA},
            },
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": encoded,
                            },
                        },
                        {
                            "type": "text",
                            "text": "Analise os sintomas visíveis nesta planta.",
                        },
                    ],
                }
            ],
        )
    except anthropic.APIError as error:
        logger.error("Falha no diagnóstico por foto pela Claude: %r", error)
        raise HTTPException(
            status_code=502,
            detail="Não foi possível analisar a foto agora. Tente novamente.",
        ) from error

    if response.stop_reason == "refusal":
        raise HTTPException(
            status_code=422,
            detail="Não foi possível analisar esta imagem. Envie uma foto nítida da planta.",
        )

    text = next((block.text for block in response.content if block.type == "text"), None)
    if not text:
        raise HTTPException(
            status_code=502, detail="A análise não retornou resultado. Tente outra foto."
        )
    try:
        result = json.loads(text)
    except json.JSONDecodeError as error:
        raise HTTPException(
            status_code=502,
            detail="A análise veio em formato inesperado. Tente novamente.",
        ) from error

    allowed = set(DIAGNOSIS_SCHEMA["properties"])
    return {key: value for key, value in result.items() if key in allowed}
