import { createClient } from "npm:@supabase/supabase-js@2.110.7";

const PRO_EVENTS = new Set(["CHECKOUT_PAID", "PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"]);
const FREE_EVENTS = new Set(["SUBSCRIPTION_INACTIVATED", "SUBSCRIPTION_DELETED", "PAYMENT_REFUNDED", "PAYMENT_CHARGEBACK_REQUESTED"]);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
type AsaasResource = { externalReference?: unknown; customer?: unknown };
type AsaasEvent = {
  id?: unknown;
  event?: unknown;
  checkout?: AsaasResource;
  payment?: AsaasResource;
  subscription?: AsaasResource;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: true });
  const token = req.headers.get("asaas-access-token");
  const expected = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
  if (!expected || token !== expected) return json({ error: "unauthorized" }, 401);

  let event: AsaasEvent;
  try { event = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const eventId = String(event.id ?? "");
  const eventName = String(event.event ?? "");
  if (!eventId) return json({ error: "missing_event_id" }, 400);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
  const { data: duplicate } = await admin.from("billing_events").select("event_id").eq("event_id", eventId).maybeSingle();
  if (duplicate) return json({ duplicate: true });

  const resource = event.checkout ?? event.payment ?? event.subscription ?? {};
  let userId = String(resource.externalReference ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) userId = "";

  if (!userId && event.payment?.customer) {
    const asaasKey = Deno.env.get("ASAAS_API_KEY");
    if (!asaasKey) return json({ error: "asaas_api_key_not_configured" }, 500);
    const response = await fetch(`https://api.asaas.com/v3/customers/${String(event.payment.customer)}`, { headers: { access_token: asaasKey } });
    if (!response.ok) return json({ error: `asaas_customer_${response.status}` }, 502);
    const customer = await response.json() as { email?: unknown };
    const email = String(customer?.email ?? "").trim().toLowerCase();
    if (email) {
      const { data: profile } = await admin.from("profiles").select("id").ilike("email", email).maybeSingle();
      userId = profile?.id ?? "";
    }
  }

  let plan: "pro" | "gratis" | null = null;
  if (PRO_EVENTS.has(eventName)) plan = "pro";
  if (FREE_EVENTS.has(eventName)) plan = "gratis";
  if (userId && plan) {
    const { error } = await admin.from("profiles").update({ plano: plan }).eq("id", userId);
    if (error) return json({ error: error.message }, 500);
  }

  const { error: auditError } = await admin.from("billing_events").insert({
    event_id: eventId,
    event_type: eventName,
    user_id: userId || null,
    payload: event,
  });
  if (auditError) return json({ error: auditError.message }, 500);
  return json({ received: true, event: eventName, userId: userId || null, plan });
});
