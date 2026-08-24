from __future__ import annotations

import base64
import json
import logging

import anthropic
from fastapi import HTTPException

from .config import settings

logger = logging.getLogger("agryn.soil")

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
    "p_rem",
    "al",
    "h_al",
    "argila",
]

SYSTEM_PROMPT = (
    "Você extrai os valores numéricos de um laudo de análise de solo brasileiro. "
    "Retorne exatamente os números impressos no laudo, sem converter unidades e "
    "sem interpretar. Unidades usuais: pH sem unidade; P, K, S e micronutrientes "
    "(Zn, B, Fe, Mn, Cu) em mg/dm³; Ca, Mg e CTC em cmolc/dm³; V% e m% em "
    "porcentagem; matéria orgânica (M.O.) em dag/kg ou %. Use null para qualquer "
    "valor que não estiver claramente legível no laudo — nunca invente ou estime.\n\n"
    "IMPORTANTE: um laudo costuma trazer VÁRIAS amostras/áreas (ex.: 'CASA 1 - "
    "AMOSTRA 1', 'PINHEIRO 2', etc.), cada uma numa coluna com seu código de "
    "laboratório. Extraia TODAS as amostras — uma entrada por amostra. Para cada "
    "amostra, preencha 'label' com a identificação legível dela (nome da amostra "
    "e, se houver, o código do laboratório). A data e o laboratório costumam ser "
    "comuns ao laudo inteiro; repita-os em cada amostra.\n\n"
    "Responda APENAS com um objeto JSON válido (sem texto antes ou depois, sem "
    "blocos de markdown) no formato: "
    '{"samples": [ {"label": "...", "ph": num|null, "p": num|null, "k": num|null, '
    '"ca": num|null, "mg": num|null, "s": num|null, "ctc": num|null, '
    '"v_percent": num|null, "m_percent": num|null, "organic_matter": num|null, '
    '"zn": num|null, "b": num|null, "fe": num|null, "mn": num|null, "cu": num|null, '
    '"p_rem": num|null, "al": num|null, "h_al": num|null, "argila": num|null, '
    '"analysis_date": "YYYY-MM-DD"|null, "laboratory": "..."|null } ] }. '
    "Campos extras: p_rem = fósforo remanescente/P-rem em mg/L; al = alumínio "
    "trocável (Al) em cmolc/dm³; h_al = H+Al (acidez potencial) em cmolc/dm³; "
    "argila = teor de argila em %. Use null quando não aparecerem no laudo. "
    "Se houver só uma amostra, devolva a lista com um único item."
)


def _strip_fences(text: str) -> str:
    """Remove cercas de markdown (```json ... ```) que o modelo às vezes adiciona."""
    limpo = text.strip()
    if limpo.startswith("```"):
        limpo = limpo.split("\n", 1)[-1] if "\n" in limpo else limpo
        if limpo.endswith("```"):
            limpo = limpo[: limpo.rfind("```")]
    inicio = limpo.find("{")
    fim = limpo.rfind("}")
    return limpo[inicio : fim + 1] if inicio >= 0 and fim > inicio else limpo


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


async def extract_soil_values(media_type: str, data: bytes) -> list[dict]:
    """Chama o Claude e devolve a LISTA de amostras do laudo (uma ou várias)."""
    _require_anthropic_config()
    validate_upload(media_type, data)

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    try:
        response = await client.messages.create(
            model=MODEL,
            max_tokens=4096,
            system=SYSTEM_PROMPT,
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
        logger.error("Falha na extração de solo pela Claude: %r", error)
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
        parsed = json.loads(_strip_fences(text))
    except json.JSONDecodeError as error:
        logger.error("JSON inesperado na extração de solo: %r", text[:400])
        raise HTTPException(
            status_code=502,
            detail="A leitura do laudo veio em formato inesperado. Tente novamente.",
        ) from error

    # Aceita tanto {"samples": [...]} quanto uma amostra única (compat.).
    if isinstance(parsed, dict) and isinstance(parsed.get("samples"), list):
        raw_samples = parsed["samples"]
    elif isinstance(parsed, list):
        raw_samples = parsed
    else:
        raw_samples = [parsed]

    allowed = set(NUMERIC_FIELDS) | {"analysis_date", "laboratory", "label"}
    samples: list[dict] = []
    for item in raw_samples:
        if not isinstance(item, dict):
            continue
        samples.append({key: value for key, value in item.items() if key in allowed})
    if not samples:
        raise HTTPException(
            status_code=502,
            detail="A leitura do laudo não retornou amostras. Tente outra foto.",
        )
    return samples
