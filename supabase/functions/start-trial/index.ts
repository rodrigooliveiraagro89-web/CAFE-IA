import { createClient } from "npm:@supabase/supabase-js@2.110.7";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const authorization = req.headers.get("Authorization") ?? "";
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: "unauthorized" }, 401);

  const admin = createClient(url, service);
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("trial_ate")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) return json({ error: profileError.message }, 500);
  if (!profile) return json({ error: "profile_not_found" }, 404);
  if (profile.trial_ate) return json({ error: "trial_already_used" }, 409);

  const trialAte = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("profiles")
    .update({ trial_ate: trialAte })
    .eq("id", user.id)
    .is("trial_ate", null)
    .select("trial_ate")
    .maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!data) return json({ error: "trial_already_used" }, 409);
  return json({ trial_ate: data.trial_ate });
});
