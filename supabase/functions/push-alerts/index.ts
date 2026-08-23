import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

// Entrega de alertas por Web Push. Roda agendada (pg_cron -> HTTP) e calcula os
// alertas NO SERVIDOR a partir das tabelas do Supabase, para chegar no celular
// do produtor mesmo com o app fechado. A trava de acesso (x-cron-secret) segue
// ativa: o segredo esperado é lido da tabela function_secrets (gerado dentro do
// banco, sem segredo humano em env). verify_jwt fica desligado de propósito.

type Severity = "alta" | "media" | "info";
type Alert = { key: string; severity: Severity; title: string; body: string; view: string };

const NDVI_DIAS_DESATUALIZADO = 45;
const NDVI_QUEDA_RELEVANTE = 0.08;
const SOLO_DIAS_VALIDADE = 365;
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
const ATIV_PROXIMA_DIAS = 3; // avisa atividade planejada (adubação etc.) chegando

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function weekdayLabel(isoDate: string): string {
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? "" : WEEKDAYS[d.getUTCDay()];
}

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

function dm(date: string): string {
  return `${weekdayLabel(date)} (${date.slice(8, 10)}/${date.slice(5, 7)})`;
}

// Consulta a previsão pública Open-Meteo (sem chave) e devolve os alertas de
// clima (geada, chuva forte, calor extremo, veranico) — os mesmos do Início.
async function fetchWeatherAlerts(lat: number, lon: number): Promise<Alert[]> {
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
  const alerts: Alert[] = [];

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
    });
  }

  return alerts;
}

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

  // Atividades planejadas CHEGANDO (adubação, pulverização, colheita etc.):
  // avisa nos próximos dias, uma por atividade (dedup por id evita repetir).
  const plotName = new Map<string, string>();
  for (const p of plots) plotName.set(String(p.id), p.name ?? "talhão");
  for (const r of records) {
    if (r.status !== "planejada" || !r.date) continue;
    const dias = diasEntre(today, r.date);
    if (dias < 0 || dias > ATIV_PROXIMA_DIAS) continue;
    const quando = dias === 0 ? "hoje" : dias === 1 ? "amanhã" : `em ${dias} dias`;
    const nome = String(r.title || r.type || "Atividade").trim() || "Atividade";
    const onde = r.plot_id && plotName.get(String(r.plot_id)) ? ` em ${plotName.get(String(r.plot_id))}` : "";
    alerts.push({
      key: `atividade-proxima-${r.id}`,
      severity: "media",
      title: `📌 ${nome} ${quando}`,
      body: `${nome} planejada${onde} para ${dm(r.date)} (${quando}). Abra o caderno para confirmar.`,
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
  if (!subs || subs.length === 0) {
    return new Response(JSON.stringify({ ok: true, sent: 0, note: "sem assinaturas" }), {
      headers: { "Content-Type": "application/json" },
    });
  }
  const userIds = [...new Set(subs.map((s) => s.user_id))];

  const [plotsRes, recordsRes, ndviRes, soilRes, deliveriesRes] = await Promise.all([
    supabase.from("plots").select("id,user_id,name,geometry").in("user_id", userIds),
    supabase.from("field_records").select("id,user_id,plot_id,status,date,title,type").in("user_id", userIds),
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
    const userPlots = plotsByUser.get(userId) ?? [];
    const alerts = buildAlerts(
      userPlots,
      recordsByUser.get(userId) ?? [],
      ndviByUser.get(userId) ?? [],
      soilByUser.get(userId) ?? [],
      today,
    ).filter((a) => a.severity === "alta" || a.severity === "media");

    // Geada: usa o centro do primeiro talhão mapeado do usuário. Se não houver
    // limite desenhado, não dá para localizar o clima — segue sem geada.
    const centroid = userPlots
      .map((p) => plotCentroid(p.geometry))
      .find((c): c is { lat: number; lon: number } => c !== null);
    if (centroid) {
      try {
        const clima = await fetchWeatherAlerts(centroid.lat, centroid.lon);
        for (const a of clima) alerts.unshift(a);
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
