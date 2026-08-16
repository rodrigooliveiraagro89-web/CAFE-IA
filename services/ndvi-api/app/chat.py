from __future__ import annotations

import anthropic
from fastapi import HTTPException

from .config import settings

# Assistente conversacional do AGRYN. A governança do produto é embutida no
# system prompt: o assistente ORIENTA e EXPLICA, mas NÃO emite parecer técnico
# (dose de adubo, diagnóstico definitivo) sem dado validado — nesses casos ele
# remete o usuário aos módulos determinísticos do app (Análise de solo, Calagem
# e adubação). Isso mantém a coerência com o resto do AGRYN e protege o produtor
# de um número inventado por IA.

MODEL = "claude-opus-4-8"
MAX_MESSAGES = 20  # histórico recente; conversas longas são truncadas no cliente
MAX_CHARS_PER_MESSAGE = 4000
MAX_OUTPUT_TOKENS = 1024

SYSTEM_PROMPT = (
    "Você é o assistente agronômico do AGRYN, um app de gestão para cafeicultura "
    "no Brasil, com ênfase em café arábica e cafeicultura de montanha. Fale português do Brasil, como consultor de "
    "campo: claro, direto e prático.\n\n"
    "REGRA DE GOVERNANÇA (obrigatória): você NÃO emite recomendação técnica "
    "quantitativa sem dado validado. Não invente doses de fertilizante, calcário "
    "ou defensivo, nem dê um diagnóstico definitivo de praga/doença só pela "
    "descrição. Quando o usuário pedir dose ou correção, oriente-o a usar os "
    "módulos do próprio app, que calculam por norma técnica auditável:\n"
    "- 'Análise de solo' (envia foto/PDF do laudo e o app extrai os valores);\n"
    "- 'Calagem e adubação' (doses pelo Boletim 100/IAC a partir do laudo);\n"
    "- 'NDVI' e 'Mapeamento' (vigor e zonas por satélite).\n\n"
    "Você PODE: explicar conceitos, interpretar de forma qualitativa, orientar "
    "manejo geral, ajudar a usar o app e sugerir quais análises fazer. Sempre que "
    "faltar dado, diga o que falta e onde obtê-lo. Termine recomendações "
    "sensíveis lembrando que a decisão final é do engenheiro agrônomo responsável."
)

ALLOWED_ROLES = {"user", "assistant"}
MAX_CONTEXT_CHARS = 3000


def _system_with_context(context: str | None) -> str:
    """Injeta o briefing do talhão (dados reais do app) no system prompt."""
    if not isinstance(context, str) or not context.strip():
        return SYSTEM_PROMPT
    ctx = context.strip()[:MAX_CONTEXT_CHARS]
    return (
        SYSTEM_PROMPT
        + "\n\nCONTEXTO DO TALHÃO SELECIONADO (dados reais do app, calculados pelos "
        "módulos determinísticos — Boletim 100/IAC). Estes números NÃO são inventados: "
        "você PODE citá-los ao responder e deve ancorar a resposta neles quando fizer "
        "sentido. Para recalcular ou detalhar doses, remeta o usuário à aba 'Calagem e "
        "adubação'.\n" + ctx
    )


def _require_anthropic_config() -> None:
    if not settings.anthropic_api_key:
        raise HTTPException(
            status_code=503,
            detail=(
                "O assistente de IA ainda não está configurado no servidor. "
                "Tente novamente mais tarde."
            ),
        )


def sanitize_messages(messages: list[dict]) -> list[dict]:
    """Valida e normaliza o histórico vindo do cliente."""
    if not isinstance(messages, list) or not messages:
        raise HTTPException(status_code=400, detail="Envie ao menos uma mensagem.")

    trimmed = messages[-MAX_MESSAGES:]
    clean: list[dict] = []
    for item in trimmed:
        role = item.get("role")
        content = item.get("content")
        if role not in ALLOWED_ROLES or not isinstance(content, str):
            raise HTTPException(status_code=400, detail="Mensagem em formato inválido.")
        text = content.strip()
        if not text:
            continue
        clean.append({"role": role, "content": text[:MAX_CHARS_PER_MESSAGE]})

    if not clean or clean[-1]["role"] != "user":
        raise HTTPException(
            status_code=400,
            detail="A última mensagem precisa ser do usuário.",
        )
    return clean


async def chat_reply(messages: list[dict], context: str | None = None) -> str:
    """Chama o Claude com o histórico e devolve o texto da resposta."""
    _require_anthropic_config()
    clean = sanitize_messages(messages)

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    try:
        response = await client.messages.create(
            model=MODEL,
            max_tokens=MAX_OUTPUT_TOKENS,
            system=_system_with_context(context),
            messages=clean,
        )
    except anthropic.APIError as error:
        raise HTTPException(
            status_code=502,
            detail="O assistente não respondeu agora. Tente novamente em instantes.",
        ) from error

    if response.stop_reason == "refusal":
        raise HTTPException(
            status_code=422,
            detail="Não consigo responder isso. Reformule a pergunta, por favor.",
        )

    text = next(
        (block.text for block in response.content if block.type == "text"), None
    )
    if not text:
        raise HTTPException(
            status_code=502,
            detail="O assistente não retornou resposta. Tente novamente.",
        )
    return text
