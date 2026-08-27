import type { ParcelaAdubacao } from "../agronomy/types";

/**
 * cropPlan — Plano de safra do talhão (§8 do plano de evolução).
 *
 * É o container que amarra Talhão → Manejo planejado → Custos: gera as operações
 * da safra a partir do que o app JÁ sabe (cronograma da 5ª Aproximação + calendário
 * do cafeicultor), deixa o produtor pôr o custo PREVISTO de cada uma e acompanha
 * previsto × realizado. O REALIZADO continua vindo do caderno de campo
 * (field_records): concluir um item cria/vincula um registro real, então não há
 * dado duplicado — o plano só aponta para o registro que virou verdade.
 *
 * Módulo PURO (só depende de tipos): a UI passa o cronograma/calendário já
 * calculados. Assim a geração e o resumo são testáveis sem tocar em rede/engine.
 */

export type CropPlanItemStatus = "planejada" | "concluida" | "cancelada";
export type CropPlanItemSource = "calendario" | "adubacao5a" | "manual";

export type CropPlanItem = {
  id: string;
  kind: string; // categoria da operação (CalendarKind: analise, calagem, adubacao, poda, colheita…)
  title: string;
  month: number; // 1–12: época principal
  plannedCost: number; // R$ previsto (0 = não informado)
  quantity: string; // previsto (ex.: "300")
  unit: string; // ex.: "kg/ha"
  status: CropPlanItemStatus;
  fieldRecordId?: string; // vínculo com o realizado no caderno
  realizedCost?: number; // custo capturado ao concluir (do registro)
  notes: string;
  source: CropPlanItemSource;
};

export type CropPlanStatus = "rascunho" | "ativo" | "encerrado";

export type CropPlan = {
  id: string;
  propertyId: string;
  plotId: string;
  safra: string;
  title: string;
  status: CropPlanStatus;
  items: CropPlanItem[];
  createdAt: string;
  updatedAt: string;
};

/** Rótulo da safra de um talhão (fallback quando plot.season está vazio). */
export function safraLabel(season: string | undefined | null): string {
  return season || "Safra atual";
}

/**
 * Localiza o plano de um talhão para a safra atual — a MESMA chave (talhão ×
 * safra) usada ao criar. Compartilhado por CropPlanModule e CostCenter para não
 * divergirem (ex.: um usar só plotId e o outro plotId+safra).
 */
export function findPlanForPlot<T extends { plotId: string; safra: string }>(
  plans: T[],
  plotId: string,
  season: string | undefined | null,
): T | null {
  const safra = safraLabel(season);
  return plans.find((p) => p.plotId === plotId && p.safra === safra) ?? null;
}

// Rótulos amigáveis por categoria (para chips/ícones na UI e no relatório).
export const KIND_LABEL: Record<string, string> = {
  analise: "Análise",
  foliar: "Foliar",
  calagem: "Calagem/Gessagem",
  poda: "Poda",
  manejo: "Manejo",
  adubacao: "Adubação",
  plantio: "Plantio",
  desbrota: "Desbrota",
  colheita: "Colheita",
  outro: "Outro",
};

const MES_NUM: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  março: 3,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};

/** Extrai o mês (1–12) do rótulo de época da parcela ("Outubro", "Janeiro/Fevereiro"). */
export function mesFromEpoca(epoca: string): number {
  const primeiro = epoca.split(/[/\s–-]/)[0]?.trim().toLowerCase() ?? "";
  return MES_NUM[primeiro] ?? 1;
}

type CalendarActivity = { id: string; label: string; kind: string; months: number[] };

/**
 * Gera os itens do plano a partir do calendário do cafeicultor e, quando há
 * recomendação de solo, do cronograma de adubação da 5ª. As entradas de adubação
 * do calendário são substituídas pelas parcelas concretas (época + N-P-K), para
 * o plano carregar a dose real em vez de um lembrete genérico.
 */
export function generatePlanItems(opts: {
  calendar: CalendarActivity[];
  cronograma?: ParcelaAdubacao[];
  idFactory: () => string;
}): CropPlanItem[] {
  const { calendar, cronograma, idFactory } = opts;
  const temCronograma = Array.isArray(cronograma) && cronograma.length > 0;
  const items: CropPlanItem[] = [];

  for (const atividade of calendar) {
    // Se já vamos detalhar a adubação de SOLO pelas parcelas da 5ª, não
    // duplicamos o lembrete genérico. Filtramos por kind ("adubacao") e não por
    // prefixo do id — "adubacao-foliar" tem kind "foliar" e NÃO é coberta pelas
    // parcelas (só solo N-P-K-S), então deve permanecer no plano.
    if (temCronograma && atividade.kind === "adubacao") continue;
    const month = Math.min(...atividade.months);
    const outros = atividade.months.filter((m) => m !== month);
    items.push({
      id: idFactory(),
      kind: atividade.kind,
      title: atividade.label,
      month,
      plannedCost: 0,
      quantity: "",
      unit: "",
      status: "planejada",
      notes: outros.length ? `Época também em: ${outros.join(", ")}.` : "",
      source: "calendario",
    });
  }

  if (temCronograma) {
    for (const parcela of cronograma!) {
      const doses = [
        parcela.N_kg_ha ? `N ${parcela.N_kg_ha}` : "",
        parcela.P2O5_kg_ha ? `P₂O₅ ${parcela.P2O5_kg_ha}` : "",
        parcela.K2O_kg_ha ? `K₂O ${parcela.K2O_kg_ha}` : "",
        parcela.S_kg_ha ? `S ${parcela.S_kg_ha}` : "",
      ].filter(Boolean);
      items.push({
        id: idFactory(),
        kind: "adubacao",
        title: `Adubação — ${parcela.epoca} (parcela ${parcela.ordem})`,
        month: mesFromEpoca(parcela.epoca),
        plannedCost: 0,
        quantity: doses.join(" · "),
        unit: "kg/ha",
        status: "planejada",
        notes: "Dose da 5ª Aproximação parcelada nas águas.",
        source: "adubacao5a",
      });
    }
  }

  return sortPlanItems(items);
}

/** Ordena por mês (jan→dez) e, no mesmo mês, mantém a ordem de inserção. */
export function sortPlanItems(items: CropPlanItem[]): CropPlanItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => a.item.month - b.item.month || a.index - b.index)
    .map(({ item }) => item);
}

export type PlanSummary = {
  plannedTotal: number;
  realizedTotal: number;
  doneCount: number;
  plannedCount: number;
  canceledCount: number;
  activeCount: number;
  adherencePct: number;
};

/**
 * Resumo previsto × realizado. O realizado de um item concluído vem do custo do
 * registro vinculado no caderno (fonte única do realizado); se o registro não
 * existir mais, cai no custo capturado no momento da conclusão.
 */
export function summarizePlan(
  plan: Pick<CropPlan, "items">,
  records: { id: string; cost: number }[],
): PlanSummary {
  const custoPorRegistro = new Map(records.map((r) => [r.id, r.cost]));
  let plannedTotal = 0;
  let realizedTotal = 0;
  let doneCount = 0;
  let plannedCount = 0;
  let canceledCount = 0;

  for (const item of plan.items) {
    if (item.status === "cancelada") {
      canceledCount += 1;
      continue;
    }
    plannedTotal += item.plannedCost > 0 ? item.plannedCost : 0;
    if (item.status === "concluida") {
      doneCount += 1;
      realizedTotal += realizedOf(item, custoPorRegistro);
    } else {
      plannedCount += 1;
    }
  }

  const activeCount = doneCount + plannedCount;
  const adherencePct = activeCount > 0 ? Math.round((doneCount / activeCount) * 100) : 0;
  return { plannedTotal, realizedTotal, doneCount, plannedCount, canceledCount, activeCount, adherencePct };
}

export type PlanCategoryCost = { kind: string; label: string; planned: number; realized: number };

/** Custo realizado de um item concluído — do registro vinculado, com fallback. */
function realizedOf(item: CropPlanItem, custoPorRegistro: Map<string, number>): number {
  if (item.status !== "concluida") return 0;
  const doRegistro = item.fieldRecordId ? custoPorRegistro.get(item.fieldRecordId) : undefined;
  return doRegistro ?? item.realizedCost ?? 0;
}

/**
 * Previsto × realizado do plano quebrado por categoria (kind). Só entram
 * categorias com algum valor (previsto ou realizado); itens cancelados ficam de
 * fora. Ordena pelo maior previsto, depois maior realizado.
 */
export function planCostByCategory(
  plan: Pick<CropPlan, "items">,
  records: { id: string; cost: number }[],
): PlanCategoryCost[] {
  const custoPorRegistro = new Map(records.map((r) => [r.id, r.cost]));
  const porKind = new Map<string, { planned: number; realized: number }>();

  for (const item of plan.items) {
    if (item.status === "cancelada") continue;
    const atual = porKind.get(item.kind) ?? { planned: 0, realized: 0 };
    atual.planned += item.plannedCost > 0 ? item.plannedCost : 0;
    atual.realized += realizedOf(item, custoPorRegistro);
    porKind.set(item.kind, atual);
  }

  return [...porKind.entries()]
    .filter(([, v]) => v.planned > 0 || v.realized > 0)
    .map(([kind, v]) => ({ kind, label: KIND_LABEL[kind] ?? kind, planned: v.planned, realized: v.realized }))
    .sort((a, b) => b.planned - a.planned || b.realized - a.realized);
}
