import { getProcessingApiUrl } from "../ndvi/processingClient";
import { supabase } from "../../lib/supabaseClient";
import { fetchWithTimeout } from "../../lib/http";

const fallbackCheckout = import.meta.env.VITE_ASAAS_CHECKOUT_URL?.trim()
  || "https://www.asaas.com/c/fw5jokq1e8cfdink";

async function errorMessage(response: Response, fallback: string) {
  try {
    const payload = await response.json() as { detail?: string; message?: string };
    return payload.detail || payload.message || fallback;
  } catch {
    return fallback;
  }
}

export async function activateTrial(accessToken: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke("start-trial", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (error) throw new Error("Não foi possível ativar o teste grátis. Tente novamente.");
  return (data as { trial_ate: string }).trial_ate;
}

export async function createProCheckout(accessToken: string, name: string): Promise<string> {
  const apiUrl = getProcessingApiUrl();
  if (!apiUrl) return fallbackCheckout;
  const response = await fetchWithTimeout(`${apiUrl}/v1/billing/checkout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (response.status === 503) return fallbackCheckout;
  if (!response.ok) throw new Error(await errorMessage(response, "Não foi possível abrir o checkout."));
  const payload = await response.json() as { url: string };
  return payload.url;
}
