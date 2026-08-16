import { getProcessingApiUrl } from "../ndvi/processingClient";
import { AI_TIMEOUT_MS, fetchWithTimeout } from "../../lib/http";

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

async function responseMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string; detail?: string };
    return payload.message || payload.detail || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Envia o histórico ao assistente e devolve a resposta do modelo. O backend
 * valida auth, cota e governança; aqui só transportamos as mensagens.
 */
export async function sendChat(
  messages: ChatMessage[],
  accessToken: string,
  context?: string,
): Promise<string> {
  const apiUrl = getProcessingApiUrl();
  if (!apiUrl) {
    throw new Error("O assistente de IA não está configurado no momento.");
  }

  const body: { messages: ChatMessage[]; context?: string } = { messages };
  if (context && context.trim()) body.context = context.trim();

  const response = await fetchWithTimeout(
    `${apiUrl}/v1/chat`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    },
    AI_TIMEOUT_MS,
  );

  if (!response.ok) {
    throw new Error(await responseMessage(response, "O assistente não respondeu agora."));
  }

  const payload = (await response.json()) as { reply?: string };
  if (!payload.reply) {
    throw new Error("O assistente não retornou resposta.");
  }
  return payload.reply;
}
