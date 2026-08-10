/**
 * fetch com timeout. Sem isto, numa conexão de fazenda (2G/oscilante) uma
 * requisição pendura para sempre: o spinner nunca para e o produtor acha que
 * o app travou. Aqui, passado o limite, abortamos e devolvemos um erro claro
 * em português — o app pode cair no modo manual ou pedir para tentar de novo.
 */

// Limite padrão para chamadas rápidas (cotação, clima, geocoding, sessão).
export const DEFAULT_TIMEOUT_MS = 20_000;
// Chamadas de IA (extração de laudo, visão, chat) processam mais tempo.
export const AI_TIMEOUT_MS = 90_000;

export class TimeoutError extends Error {
  constructor(message = "A conexão demorou demais. Verifique o sinal e tente de novo.") {
    super(message);
    this.name = "TimeoutError";
  }
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: init.signal ?? controller.signal });
  } catch (error) {
    // Distingue timeout (abort disparado por nós) de queda de rede genérica.
    if (controller.signal.aborted && !(init.signal?.aborted ?? false)) {
      throw new TimeoutError();
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
