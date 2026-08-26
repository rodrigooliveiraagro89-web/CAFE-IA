import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { dm, pushAlerts, type AlertInput, type CanonicalAlert } from "./alertRules.ts";

// Entrega de alertas por Web Push. Roda agendada (pg_cron -> HTTP) e calcula os
// alertas NO SERVIDOR a partir das tabelas do Supabase, para chegar no celular
// do produtor mesmo com o app fechado. A trava de acesso (x-cron-secret) segue
// ativa: o segredo esperado é lido da tabela function_secrets (gerado dentro do
// banco, sem segredo humano em env). verify_jwt fica desligado de propósito.
//
// A DERIVAÇÃO dos alertas (limiares, NDVI/solo/atividades, calendário mensal)
// mora em ./alertRules.ts — a MESMA fonte que o app usa (src/domain/alertRules.ts),
// copiada byte a byte no deploy. Assim o que chega por push bate com a tela.
// Aqui ficam só as partes do servidor: previsão do tempo (clima), dedup e envio.

const REENVIO_DIAS = 7;

// Geada — o push mais crítico p/ café de montanha. Mínima prevista para as
// próximas madrugadas: ≤ 3 °C é risco alto; ≤ 5 °C é atenção. Só olhamos os
// próximos dias (a janela acionável), e a chave inclui a DATA da madrugada
// para que uma nova noite fria dispare de novo sem repetir a mesma.
const GEADA_SEVERA_C = 3;
const GEADA_ATENCAO_C = 5;
const GEADA_DIAS_A_FRENTE = 2;
const CHUVA_FORTE_MM = 30; // >= 30 mm/dia
const CALOR_MAX_C = 34; // >= 34 °C
const CLIMA_DIAS_A_FRENTE = 3; // janela p/ chuva/calor/veranico

// Centro do talhão a partir da geometria GeoJSON (anel [lng,lat]).
function plotCentroid(geometry: any): { lat: number; lon: number } | null {
  const ring = geometry?.coordinates?.[0];
  if (!Array.isArray(ring) || ring.length === 0) return null;
  const pts =
    ring.length > 1 &&
    ring[0]?.[0] === ring[ring.length - 1]?.[0] &&
    ring[0]?.[1] === ring[ring.length - 1]?.[1]
      ? ring.slice(0, -1)
      : ring;
  if (pts.length === 0) return null;
  let sumLon = 0;
  let sumLat = 0;
  for (const [lon, lat] of pts) {
    sumLon += Number(lon);
    sumLat += Number(lat);
  }
  return { lat: sumLat / pts.length, lon: sumLon / pts.length };
}

// Consulta a previsão pública Open-Meteo (sem chave) e devolve os alertas de
// clima (geada, chuva forte, calor extremo, veranico) — os mesmos do Início.
async function fetchWeatherAlerts(lat: number, lon: number): Promise<CanonicalAlert[]> {
  const days = CLIMA_DIAS_A_FRENTE + 1;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=temperature_2m_min,temperature_2m_max,precipitation_sum&timezone=auto&forecast_days=${days}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = (await res.json()) as {
    daily?: {
      time?: string[];
      temperature_2m_min?: number[];
      temperature_2m_max?: number[];
      precipitation_sum?: number[];
    };
  };
  const time = data.daily?.time ?? [];
  const tmin = data.daily?.temperature_2m_min ?? [];
  const tmax = data.daily?.temperature_2m_max ?? [];
  const prec = data.daily?.precipitation_sum ?? [];
  const alerts: CanonicalAlert[] = [];

  // Geada — próximas madrugadas (ignora hoje, já em curso).
  let coldest: { date: string; min: number } | null = null;
  for (let i = 1; i <= GEADA_DIAS_A_FRENTE && i < time.length; i += 1) {
    const min = Math.round(tmin[i]);
    if (!Number.isFinite(min) || min > GEADA_ATENCAO_C) continue;
    if (!coldest || min < coldest.min) coldest = { date: time[i], min };
  }
  if (coldest) {
    const severa = coldest.min <= GEADA_SEVERA_C;
    alerts.push({
      key: `geada-${coldest.date}`,
      severity: severa ? "alta" : "media",
      title: severa ? `❄️ Risco de geada (${coldest.min}°C)` : `❄️ Atenção a geada (${coldest.min}°C)`,
      body: `Mínima de ${coldest.min}°C na madrugada de ${dm(coldest.date)}. Avalie proteção da lavoura.`,
      view: "clima",
      actionLabel: "Ver no clima",
    });
  }

  // Chuva forte e calor extremo — próximos dias (inclui hoje).
  let hasRain = false;
  for (let i = 0; i < days && i < time.length; i += 1) {
    const rain = Math.round((prec[i] ?? 0) * 10) / 10;
    if (rain >= 1) hasRain = true;
    if (rain >= CHUVA_FORTE_MM) {
      alerts.push({
        key: `chuva-forte-${time[i]}`,
        severity: "media",
        title: `🌧️ Chuva forte (${rain} mm)`,
        body: `${rain} mm previstos para ${dm(time[i])}. Evite adubação em cobertura antes (lixiviação) e planeje colheita/drenagem.`,
        view: "clima",
        actionLabel: "Ver no clima",
      });
      break;
    }
  }
  for (let i = 0; i < days && i < time.length; i += 1) {
    const max = Math.round(tmax[i]);
    if (Number.isFinite(max) && max >= CALOR_MAX_C) {
      alerts.push({
        key: `calor-${time[i]}`,
        severity: "media",
        title: `🔥 Calor extremo (${max}°C)`,
        body: `Máxima de ${max}°C para ${dm(time[i])}. Evite pulverizar nas horas quentes; atenção ao estresse na florada/granação.`,
        view: "clima",
        actionLabel: "Ver no clima",
      });
      break;
    }
  }

  // Veranico — nenhuma chuva relevante na janela toda.
  if (!hasRain && time.length >= days) {
    alerts.push({
      key: "veranico",
      severity: "media",
      title: "☀️ Sem chuva nos próximos dias",
      body: `Nenhuma chuva relevante prevista para os próximos ${days} dias. Atenção ao déficit hídrico e programe irrigação.`,
      view: "clima",
      actionLabel: "Ver no clima",
    });
  }

  return alerts;
}

function groupBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = map.get(k) ?? [];
    list.push(row);
    map.set(k, list);
  }
  return map;
}

// Monta a forma normalizada que alertRules espera a partir das linhas do banco.
function toAlertInput(plots: any[], records: any[], ndvi: any[], soil: any[]): AlertInput {
  return {
    plots: plots.map((p) => ({ id: String(p.id), name: p.name ?? "talhão" })),
    records: records.map((r) => ({
      id: String(r.id),
      status: r.status,
      date: r.date,
      plotId: r.plot_id != null ? String(r.plot_id) : null,
      title: r.title,
      type: r.type,
    })),
    ndvi: ndvi.map((r) => {
      const mean = Number(r?.result?.statistics?.mean);
      return {
        plotId: String(r.plot_id),
        acquiredAt: r.acquired_at,
        mean: Number.isFinite(mean) ? mean : null,
      };
    }),
    soil: soil.map((s) => ({ plotId: String(s.plot_id), date: s.analysis_date ?? s.created_at })),
  };
}

// Envio por WhatsApp via Cloud API (Meta). Usa um TEMPLATE aprovado com dois
// parâmetros no corpo: {{1}} = título, {{2}} = mensagem. Só envia se as
// credenciais estiverem configuradas nos secrets da função.
async function sendWhatsapp(to: string, alert: CanonicalAlert): Promise<boolean> {
  const token = Deno.env.get("WHATSAPP_TOKEN") ?? "";
  const phoneId = Deno.env.get("WHATSAPP_PHONE_ID") ?? "";
  if (!token || !phoneId) return false;
  const template = Deno.env.get("WHATSAPP_TEMPLATE") ?? "agryn_alerta";
  const lang = Deno.env.get("WHATSAPP_LANG") ?? "pt_BR";
  const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: template,
        language: { code: lang },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: alert.title },
              { type: "text", text: alert.body },
            ],
          },
        ],
      },
    }),
  });
  return res.ok;
}

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Trava de acesso: segredo esperado vem da tabela (gerado no banco).
  const { data: secretRow } = await supabase
    .from("function_secrets")
    .select("value")
    .eq("name", "push_cron")
    .single();
  const expected = secretRow?.value ?? "";
  if (!expected || req.headers.get("x-cron-secret") !== expected) {
    return new Response(JSON.stringify({ error: "não autorizado" }), { status: 401 });
  }

  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:contato@agryn.app";
  if (!vapidPublic || !vapidPrivate) {
    return new Response(JSON.stringify({ error: "VAPID não configurado" }), { status: 503 });
  }
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const appUrl = Deno.env.get("APP_URL") ?? "https://rodrigooliveiraagro89-web.github.io/CAFE-IA/";

  // Modo TESTE: envia um push imediato para as assinaturas de um usuário
  // (ignora cálculo de alertas e dedup). Serve para conferir o canal fim a fim.
  // Invoque com body {"test": true, "userId": "..."} + o mesmo x-cron-secret.
  const reqBody = await req.json().catch(() => ({} as Record<string, unknown>));
  if (reqBody?.test) {
    const uid = String(reqBody.userId ?? "");
    const { data: testSubs } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", uid);
    let n = 0;
    let gone = 0;
    for (const sub of testSubs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: "✅ Teste AGRYN",
            body: "Se você recebeu isto, os alertas por push estão funcionando.",
            url: appUrl,
            tag: "agryn-teste",
          }),
        );
        n += 1;
      } catch (err) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          gone += 1;
        }
      }
    }
    return new Response(JSON.stringify({ ok: true, test: true, sent: n, expired: gone }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: subs } = await supabase.from("push_subscriptions").select("*");
  const { data: waProfiles } = await supabase
    .from("profiles")
    .select("id,whatsapp,whatsapp_opt_in")
    .eq("whatsapp_opt_in", true);
  const whatsappByUser = new Map<string, string>();
  for (const p of waProfiles ?? []) {
    if (p.whatsapp) whatsappByUser.set(p.id, String(p.whatsapp));
  }
  const subsList = subs ?? [];
  const userIds = [...new Set([...subsList.map((s) => s.user_id), ...whatsappByUser.keys()])];
  if (userIds.length === 0) {
    return new Response(JSON.stringify({ ok: true, sent: 0, note: "sem assinantes" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const [plotsRes, recordsRes, ndviRes, soilRes, deliveriesRes, prefsRes] = await Promise.all([
    supabase.from("plots").select("id,user_id,name,geometry").in("user_id", userIds),
    supabase.from("field_records").select("id,user_id,plot_id,status,date,title,type").in("user_id", userIds),
    supabase.from("ndvi_results").select("user_id,plot_id,acquired_at,result").in("user_id", userIds),
    supabase.from("soil_analyses").select("user_id,plot_id,analysis_date,created_at").in("user_id", userIds),
    supabase.from("alert_deliveries").select("user_id,alert_key,sent_at").in("user_id", userIds),
    supabase.from("notification_preferences").select("user_id,min_severity,active").in("user_id", userIds),
  ]);

  // Preferência de nível por usuário (padrão: media, ativo).
  const prefByUser = new Map<string, { min: string; active: boolean }>();
  for (const p of prefsRes.data ?? []) {
    prefByUser.set(p.user_id, { min: p.min_severity ?? "media", active: p.active !== false });
  }

  const plotsByUser = groupBy(plotsRes.data ?? [], (r) => r.user_id);
  const recordsByUser = groupBy(recordsRes.data ?? [], (r) => r.user_id);
  const ndviByUser = groupBy(ndviRes.data ?? [], (r) => r.user_id);
  const soilByUser = groupBy(soilRes.data ?? [], (r) => r.user_id);
  const subsByUser = groupBy(subsList, (r) => r.user_id);
  const today = new Date().toISOString().slice(0, 10);
  const now = Date.now();

  const jaEnviado = new Map<string, number>();
  for (const d of deliveriesRes.data ?? []) {
    jaEnviado.set(`${d.user_id}:${d.alert_key}`, new Date(d.sent_at).getTime());
  }

  let sent = 0;
  let removed = 0;

  for (const userId of userIds) {
    const pref = prefByUser.get(userId) ?? { min: "media", active: true };
    if (!pref.active) continue; // usuário desativou os alertas
    // Nível mínimo: 'alta' → só alta; 'media' → alta + média.
    const aceita = (sev: string) => (pref.min === "alta" ? sev === "alta" : sev === "alta" || sev === "media");
    const userPlots = plotsByUser.get(userId) ?? [];
    const input = toAlertInput(
      userPlots,
      recordsByUser.get(userId) ?? [],
      ndviByUser.get(userId) ?? [],
      soilByUser.get(userId) ?? [],
    );
    const alerts = pushAlerts(input, today).filter((a) => aceita(a.severity));

    // Geada: usa o centro do primeiro talhão mapeado do usuário. Se não houver
    // limite desenhado, não dá para localizar o clima — segue sem geada.
    const centroid = userPlots
      .map((p) => plotCentroid(p.geometry))
      .find((c): c is { lat: number; lon: number } => c !== null);
    if (centroid) {
      try {
        const clima = await fetchWeatherAlerts(centroid.lat, centroid.lon);
        for (const a of clima) if (aceita(a.severity)) alerts.unshift(a);
      } catch (_) {
        // Falha na previsão não pode derrubar o envio dos demais alertas.
      }
    }

    for (const alert of alerts) {
      const anterior = jaEnviado.get(`${userId}:${alert.key}`);
      if (anterior && now - anterior < REENVIO_DIAS * 86_400_000) continue;

      const payload = JSON.stringify({
        title: alert.title,
        body: alert.body,
        url: `${appUrl}?view=${alert.view}`,
        tag: alert.key,
      });

      let entregou = false;
      for (const sub of subsByUser.get(userId) ?? []) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          );
          entregou = true;
          sent += 1;
        } catch (err) {
          const status = (err as { statusCode?: number })?.statusCode;
          if (status === 404 || status === 410) {
            await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
            removed += 1;
          }
        }
      }

      // WhatsApp (Meta Cloud API) para quem autorizou. Mesmo dedup do push.
      const waNumber = whatsappByUser.get(userId);
      if (waNumber) {
        try {
          if (await sendWhatsapp(waNumber, alert)) entregou = true;
        } catch (_) {
          // Falha no WhatsApp não derruba o restante.
        }
      }

      if (entregou) {
        await supabase
          .from("alert_deliveries")
          .upsert(
            { user_id: userId, alert_key: alert.key, title: alert.title, sent_at: new Date().toISOString() },
            { onConflict: "user_id,alert_key" },
          );
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, sent, removed }), {
    headers: { "Content-Type": "application/json" },
  });
});
