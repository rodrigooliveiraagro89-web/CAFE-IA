// AUTO-SINCRONIZADO com src/domain/alertRules.ts (fonte única dos alertas).
// NÃO edite aqui — edite o original e rode: npm run sync:alert-rules
// (o teste alertRules.sync.test.ts falha se este arquivo divergir do original).

/**
 * alertRules — FONTE ÚNICA dos alertas e do calendário do cafeicultor.
 *
 * Este módulo é a autoridade compartilhada entre:
 *   - o app (src/domain/alerts.ts adapta os objetos de domínio p/ o painel Início);
 *   - a Edge Function push-alerts (recebe uma cópia idêntica no deploy e adapta
 *     as linhas do banco), evitando o "drift" de quando havia dois buildAlerts
 *     mantidos à mão com limiares diferentes (o laudo vencia com 360 dias no app
 *     e 365 no servidor, por exemplo).
 *
 * Regra de projeto: SEM imports. Precisa rodar igual no navegador (Vite) e no
 * Deno (Supabase). Trabalha sobre uma FORMA NORMALIZADA — cada consumidor faz um
 * adaptador curto dos seus dados para cá.
 */

export type AlertSeverity = "alta" | "media" | "info";

/** Alerta canônico. O app usa key/title/body/view/actionLabel; o push usa key/title/body/view. */
export type CanonicalAlert = {
  key: string;
  severity: AlertSeverity;
  title: string;
  body: string;
  view: string; // compatível com AppView ("caderno" | "ndvi" | "analise-solo" | "clima")
  actionLabel: string;
  plotId?: string;
};

// ---- Forma normalizada de entrada (cada lado adapta os seus dados) ----------
export type AlertPlot = { id: string; name: string };
export type AlertRecord = {
  id: string;
  status: string;
  date?: string | null;
  plotId?: string | null;
  title?: string | null;
  type?: string | null;
};
export type AlertNdvi = { plotId: string; acquiredAt: string; mean: number | null };
export type AlertSoil = { plotId: string; date: string };
export type AlertInput = {
  plots: AlertPlot[];
  records: AlertRecord[];
  ndvi: AlertNdvi[];
  soil: AlertSoil[];
};

// ---- Limiares nomeados (auditáveis, um único lugar) -------------------------
export const NDVI_DIAS_DESATUALIZADO = 45;
export const NDVI_QUEDA_RELEVANTE = 0.08; // queda de média entre a última e a penúltima cena
export const SOLO_DIAS_VALIDADE = 365; // laudo vencido após 12 meses
export const ATIV_PROXIMA_DIAS = 3; // avisa atividade planejada chegando

// ---- Calendário do cafeicultor (Sul de Minas) — ÚNICA tabela de meses -------
export type CalendarEntry = { id: string; label: string; months: number[] };
export const CALENDAR: CalendarEntry[] = [
  { id: "analise-solo", label: "Análise de solo", months: [4, 5, 6, 7] },
  { id: "analise-foliar", label: "Análise foliar", months: [1, 2, 11, 12] },
  { id: "calagem", label: "Calagem / Gessagem", months: [3, 4, 7, 8, 9] },
  { id: "podas", label: "Podas", months: [6, 7, 8] },
  { id: "manejo-mato", label: "Manejo do mato", months: [1, 2, 3, 4, 10, 11, 12] },
  { id: "adubacao-solo", label: "Adubação via solo", months: [1, 2, 9, 10, 11, 12] },
  { id: "adubacao-foliar", label: "Adubação foliar", months: [1, 2, 3, 9, 10, 11, 12] },
  { id: "plantio", label: "Plantio das mudas", months: [1, 2, 10, 11, 12] },
  { id: "desbrotas", label: "Desbrotas", months: [1, 2, 3, 4, 5, 6, 12] },
  { id: "colheita", label: "Colheita", months: [4, 5, 6, 7, 8] },
];

const MESES = [
  "",
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export function monthName(month: number): string {
  return MESES[month] ?? "";
}

// ---- Utilidades de data (UTC, deterministas em qualquer runtime) ------------
export function diasEntre(deISO: string, ateISO: string): number {
  const de = new Date(`${deISO.slice(0, 10)}T00:00:00Z`).getTime();
  const ate = new Date(`${ateISO.slice(0, 10)}T00:00:00Z`).getTime();
  if (Number.isNaN(de) || Number.isNaN(ate)) return 0;
  return Math.round((ate - de) / 86_400_000);
}

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function weekdayLabel(isoDate: string): string {
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? "" : WEEKDAYS[d.getUTCDay()];
}

/** "seg (12/08)" — usado nos textos de atividade próxima. */
export function dm(date: string): string {
  return `${weekdayLabel(date)} (${date.slice(8, 10)}/${date.slice(5, 7)})`;
}

function ultimoPorData<T>(itens: T[], dataDe: (item: T) => string): T | null {
  if (!itens.length) return null;
  return [...itens].sort(
    (a, b) => new Date(dataDe(b)).getTime() - new Date(dataDe(a)).getTime(),
  )[0];
}

// ---- Derivadores de alerta (as regras propriamente ditas) -------------------

/** Atividades planejadas com data já vencida — um alerta agregado. */
export function overdueAlert(records: AlertRecord[], today: string): CanonicalAlert | null {
  const atrasadas = records.filter(
    (r) => r.status === "planejada" && r.date && diasEntre(r.date, today) > 0,
  );
  if (atrasadas.length === 0) return null;
  return {
    key: "atividades-atrasadas",
    severity: "alta",
    title: atrasadas.length === 1 ? "1 atividade atrasada" : `${atrasadas.length} atividades atrasadas`,
    body: "Atividades planejadas cuja data já passou e ainda não foram concluídas.",
    view: "caderno",
    actionLabel: "Abrir caderno",
  };
}

/** Atividades planejadas CHEGANDO nos próximos dias (uma por atividade). */
export function upcomingActivityAlerts(input: AlertInput, today: string): CanonicalAlert[] {
  const nameById = new Map<string, string>();
  for (const p of input.plots) nameById.set(String(p.id), p.name);
  const out: CanonicalAlert[] = [];
  for (const r of input.records) {
    if (r.status !== "planejada" || !r.date) continue;
    const dias = diasEntre(today, r.date);
    if (dias < 0 || dias > ATIV_PROXIMA_DIAS) continue;
    const quando = dias === 0 ? "hoje" : dias === 1 ? "amanhã" : `em ${dias} dias`;
    const nome = String(r.title || r.type || "Atividade").trim() || "Atividade";
    const nomePlot = r.plotId ? nameById.get(String(r.plotId)) : undefined;
    const onde = nomePlot ? ` em ${nomePlot}` : "";
    out.push({
      key: `atividade-proxima-${r.id}`,
      severity: "media",
      title: `📌 ${nome} ${quando}`,
      body: `${nome} planejada${onde} para ${dm(r.date)} (${quando}). Abra o caderno para confirmar.`,
      view: "caderno",
      actionLabel: "Abrir caderno",
      plotId: r.plotId ? String(r.plotId) : undefined,
    });
  }
  return out;
}

/** Alertas de NDVI de um talhão (queda / desatualizado / ausente). */
function ndviAlertsForPlot(plot: AlertPlot, ndvi: AlertNdvi[], today: string): CanonicalAlert[] {
  const out: CanonicalAlert[] = [];
  const cenas = ndvi
    .filter((r) => String(r.plotId) === String(plot.id))
    .sort((a, b) => new Date(b.acquiredAt).getTime() - new Date(a.acquiredAt).getTime());

  if (cenas.length >= 2) {
    const m0 = cenas[0].mean;
    const m1 = cenas[1].mean;
    if (m0 !== null && m1 !== null && Number.isFinite(m0) && Number.isFinite(m1) && m1 - m0 >= NDVI_QUEDA_RELEVANTE) {
      out.push({
        key: `ndvi-queda-${plot.id}`,
        severity: "alta",
        title: `Vigor em queda em ${plot.name}`,
        body: `NDVI médio caiu de ${m1.toFixed(2)} para ${m0.toFixed(2)} na última cena. Vale uma inspeção de campo.`,
        view: "ndvi",
        actionLabel: "Ver NDVI",
        plotId: plot.id,
      });
    }
  }

  const ultimo = cenas[0] ?? null;
  if (!ultimo) {
    out.push({
      key: `ndvi-ausente-${plot.id}`,
      severity: "info",
      title: `Sem monitoramento NDVI em ${plot.name}`,
      body: "Processe uma cena de satélite para acompanhar o vigor da lavoura.",
      view: "ndvi",
      actionLabel: "Processar NDVI",
      plotId: plot.id,
    });
  } else if (diasEntre(ultimo.acquiredAt, today) > NDVI_DIAS_DESATUALIZADO) {
    out.push({
      key: `ndvi-desatualizado-${plot.id}`,
      severity: "media",
      title: `NDVI desatualizado em ${plot.name}`,
      body: `A última cena tem mais de ${NDVI_DIAS_DESATUALIZADO} dias. Atualize para acompanhar a evolução.`,
      view: "ndvi",
      actionLabel: "Atualizar NDVI",
      plotId: plot.id,
    });
  }
  return out;
}

/** Alertas de análise de solo de um talhão (ausente / vencida). */
function soilAlertsForPlot(plot: AlertPlot, soil: AlertSoil[], today: string): CanonicalAlert[] {
  const solosPlot = soil.filter((s) => String(s.plotId) === String(plot.id));
  const ultimo = ultimoPorData(solosPlot, (s) => s.date);
  if (!ultimo) {
    return [
      {
        key: `solo-ausente-${plot.id}`,
        severity: "media",
        title: `Sem análise de solo em ${plot.name}`,
        body: "A recomendação de calagem e adubação depende do laudo do talhão.",
        view: "analise-solo",
        actionLabel: "Enviar laudo",
        plotId: plot.id,
      },
    ];
  }
  if (diasEntre(ultimo.date, today) > SOLO_DIAS_VALIDADE) {
    return [
      {
        key: `solo-vencido-${plot.id}`,
        severity: "media",
        title: `Análise de solo vencida em ${plot.name}`,
        body: "O último laudo tem mais de 12 meses. Uma amostragem nova mantém a adubação calibrada.",
        view: "analise-solo",
        actionLabel: "Nova análise",
        plotId: plot.id,
      },
    ];
  }
  return [];
}

/** Alertas por talhão (NDVI + solo). */
export function plotAlerts(plot: AlertPlot, input: AlertInput, today: string): CanonicalAlert[] {
  return [...ndviAlertsForPlot(plot, input.ndvi, today), ...soilAlertsForPlot(plot, input.soil, today)];
}

/** Resumo mensal do calendário — uma notificação por mês (chave YYYY-MM). */
export function calendarSummary(today: string): CanonicalAlert | null {
  const month = Number(today.slice(5, 7));
  const labels = CALENDAR.filter((a) => a.months.includes(month)).map((a) => a.label);
  if (labels.length === 0) return null;
  return {
    key: `calendario-${today.slice(0, 7)}`,
    severity: "media",
    title: `📅 Calendário de ${monthName(month)}`,
    body: `Época de: ${labels.join(", ")}. Veja no Clima o que fazer e a melhor janela.`,
    view: "clima",
    actionLabel: "Ver no clima",
  };
}

/**
 * Alertas derivados de dados que o APP mostra no painel Início:
 * atividades atrasadas + (por talhão) NDVI e solo. Sem calendário/próximas nem
 * clima — o painel do app já monta calendário e clima por outras vias.
 */
export function coreAlerts(input: AlertInput, today: string): CanonicalAlert[] {
  const out: CanonicalAlert[] = [];
  const overdue = overdueAlert(input.records, today);
  if (overdue) out.push(overdue);
  for (const plot of input.plots) out.push(...plotAlerts(plot, input, today));
  return out;
}

/**
 * Alertas que o PUSH entrega (mesma derivação do app + calendário mensal e
 * atividades chegando). O clima (geada/chuva/calor/veranico) é acrescentado
 * separadamente pela Edge Function, que tem acesso à previsão.
 */
export function pushAlerts(input: AlertInput, today: string): CanonicalAlert[] {
  const out: CanonicalAlert[] = [];
  const cal = calendarSummary(today);
  if (cal) out.push(cal);
  const overdue = overdueAlert(input.records, today);
  if (overdue) out.push(overdue);
  out.push(...upcomingActivityAlerts(input, today));
  for (const plot of input.plots) out.push(...plotAlerts(plot, input, today));
  return out;
}
