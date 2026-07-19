export type PlanId = "gratis" | "pro";

export type PlanLimits = {
  id: PlanId;
  label: string;
  maxProperties: number;
  maxPlotsPerProperty: number;
};

// Limites do plano gratuito são aplicados na interface. O plano Pro é
// atribuído manualmente no perfil (coluna profiles.plano) até o gateway
// de pagamento entrar; a partir daí passa a ser automático.
export const plans: Record<PlanId, PlanLimits> = {
  gratis: {
    id: "gratis",
    label: "Grátis",
    maxProperties: 1,
    maxPlotsPerProperty: 2,
  },
  pro: {
    id: "pro",
    label: "Pro",
    maxProperties: Number.POSITIVE_INFINITY,
    maxPlotsPerProperty: Number.POSITIVE_INFINITY,
  },
};

export const TRIAL_DAYS = 14;

export function resolvePlan(planId: string | null | undefined): PlanLimits {
  return planId === "pro" ? plans.pro : plans.gratis;
}

// Plano efetivo: assinatura Pro OU período de teste ainda vigente.
export function effectivePlanId(
  planId: string | null | undefined,
  trialAte: string | null | undefined,
  now: Date = new Date(),
): PlanId {
  if (planId === "pro") return "pro";
  if (trialAte) {
    const end = new Date(trialAte).getTime();
    if (Number.isFinite(end) && end > now.getTime()) return "pro";
  }
  return "gratis";
}

export function trialAlreadyUsed(trialAte: string | null | undefined): boolean {
  return Boolean(trialAte);
}

export function canAddProperty(plan: PlanLimits, currentCount: number): boolean {
  return currentCount < plan.maxProperties;
}

export function canAddPlot(plan: PlanLimits, plotsInProperty: number): boolean {
  return plotsInProperty < plan.maxPlotsPerProperty;
}
