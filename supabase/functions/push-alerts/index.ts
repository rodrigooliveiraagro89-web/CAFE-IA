import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

// Entrega de alertas por Web Push. Roda agendada (pg_cron -> HTTP) e calcula os
// alertas NO SERVIDOR a partir das tabelas do Supabase, para chegar no celular
// do produtor mesmo com o app fechado. Autenticada por um segredo compartilhado
// (x-cron-secret) — verify_jwt fica desligado de propósito.

type Severity = "alta" | "media" | "info";
type Alert = { key: string; severity: Severity; title: string; body: string; view: string };

const NDVI_DIAS_DESATUALIZADO = 45;
const NDVI_QUEDA_RELEVANTE = 0.08;
const SOLO_DIAS_VALIDADE = 365;
const REENVIO_DIAS = 7; // não repete o mesmo alerta antes disso

function diasEntre(deISO: string, ateISO: string): number {
  const de = new Date(`${deISO.slice(0, 10)}T00:00:00Z`).getTime();
  const ate = new Date(`${ateISO.slice(0, 10)}T00:00:00Z`).getTime();
  if (Number.isNaN(de) || Number.isNaN(ate)) return 0;
  return Math.round((ate - de) / 86_400_000);
}

function ultimoPorData<T>(itens: T[], dataDe: (i: T) => string): T | null {
  if (!itens.length) return null;
  return [...itens].sort((a, b) => new Date(dataDe(b)).getTime() - new Date(dataDe(a)).getTime())[0];
}

function buildAlerts(plots: any[], records: any[], ndvi: any[], soil: any[], today: string): Alert[] {
  const alerts: Alert[] = [];
  const atrasadas = records.filter(
    (r) => r.status === "planejada" && r.date && diasEntre(r.date, today) > 0,
  );
  if (atrasadas.length > 0) {
    alerts.push({
      key: "atividades-atrasadas",
      severity: "alta",
      title: atrasadas.length === 1 ? "1 atividade atrasada" : `${atrasadas.length} atividades atrasadas`,
      body: "Há atividades planejadas cuja data já passou. Abra o caderno de campo.",
      view: "caderno",
    });
  }
  for (const plot of plots) {
    const nome = plot.name ?? "talhão";
    const ndviPlot = ndvi
      .filter((r) => String(r.plot_id) === String(plot.id))
      .sort((a, b) => new Date(b.acquired_at).getTime() - new Date(a.acquired_at).getTime());
    if (ndviPlot.length >= 2) {
      const m0 = Number(ndviPlot[0]?.result?.statistics?.mean);
      const m1 = Number(ndviPlot[1]?.result?.statistics?.mean);
      if (Number.isFinite(m0) && Number.isFinite(m1) && m1 - m0 >= NDVI_QUEDA_RELEVANTE) {
        alerts.push({
          key: `ndvi-queda-${plot.id}`,
          severity: "alta",
          title: `Vigor em queda em ${nome}`,
          body: `NDVI médio caiu de ${m1.toFixed(2)} para ${m0.toFixed(2)}. Vale inspeção de campo.`,
          view: "ndvi",
        });
      }
    }
    const ultimoNdvi = ndviPlot[0] ?? null;
    if (ultimoNdvi && diasEntre(ultimoNdvi.acquired_at, today) > NDVI_DIAS_DESATUALIZADO) {
      alerts.push({
        key: `ndvi-desatualizado-${plot.id}`,
        severity: "media",
        title: `NDVI desatualizado em ${nome}`,
        body: `A última cena tem mais de ${NDVI_DIAS_DESATUALIZADO} dias. Atualize o monitoramento.`,
        view: "ndvi",
      });
    }
    const solosPlot = soil.filter((s) => String(s.plot_id) === String(plot.id));
    const ultimoSolo = ultimoPorData(solosPlot, (s) => s.analysis_date ?? s.created_at);
    if (!ultimoSolo) {
      alerts.push({
        key: `solo-ausente-${plot.id}`,
        severity: "media",
        title: `Sem análise de solo em ${nome}`,
        body: "A recomendação de calagem e adubação depende do laudo do talhão.",
        view: "analise-solo",
      });
    } else {
      const dataSolo = ultimoSolo.analysis_date ?? ultimoSolo.created_at;
      if (diasEntre(dataSolo, today) > SOLO_DIAS_VALIDADE) {
        alerts.push({
          key: `solo-vencido-${plot.id}`,
          severity: "media",
          title: `Análise de solo vencida em ${nome}`,
          body: "O último laudo tem mais de 12 meses. Uma amostragem nova mantém a adubação calibrada.",
          view: "analise-solo",
        });
      }
    }
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

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
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
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: subs } = await supabase.from("push_subscriptions").select("*");
  if (!subs || subs.length === 0) {
    return new Response(JSON.stringify({ ok: true, sent: 0, note: "sem assinaturas" }), {
      headers: { "Content-Type": "application/json" },
    });
  }
  const userIds = [...new Set(subs.map((s) => s.user_id))];

  const [plotsRes, recordsRes, ndviRes, soilRes, deliveriesRes] = await Promise.all([
    supabase.from("plots").select("id,user_id,name").in("user_id", userIds),
    supabase.from("field_records").select("user_id,plot_id,status,date").in("user_id", userIds),
    supabase.from("ndvi_results").select("user_id,plot_id,acquired_at,result").in("user_id", userIds),
    supabase.from("soil_analyses").select("user_id,plot_id,analysis_date,created_at").in("user_id", userIds),
    supabase.from("alert_deliveries").select("user_id,alert_key,sent_at").in("user_id", userIds),
  ]);

  const plotsByUser = groupBy(plotsRes.data ?? [], (r) => r.user_id);
  const recordsByUser = groupBy(recordsRes.data ?? [], (r) => r.user_id);
  const ndviByUser = groupBy(ndviRes.data ?? [], (r) => r.user_id);
  const soilByUser = groupBy(soilRes.data ?? [], (r) => r.user_id);
  const subsByUser = groupBy(subs, (r) => r.user_id);
  const today = new Date().toISOString().slice(0, 10);
  const now = Date.now();

  const jaEnviado = new Map<string, number>();
  for (const d of deliveriesRes.data ?? []) {
    jaEnviado.set(`${d.user_id}:${d.alert_key}`, new Date(d.sent_at).getTime());
  }

  let sent = 0;
  let removed = 0;

  for (const userId of userIds) {
    const alerts = buildAlerts(
      plotsByUser.get(userId) ?? [],
      recordsByUser.get(userId) ?? [],
      ndviByUser.get(userId) ?? [],
      soilByUser.get(userId) ?? [],
      today,
    ).filter((a) => a.severity === "alta" || a.severity === "media");

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
