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

export function resolvePlan(planId: string | null | undefined): PlanLimits {
  return planId === "pro" ? plans.pro : plans.gratis;
}

export function canAddProperty(plan: PlanLimits, currentCount: number): boolean {
  return currentCount < plan.maxProperties;
}

export function canAddPlot(plan: PlanLimits, plotsInProperty: number): boolean {
  return plotsInProperty < plan.maxPlotsPerProperty;
}
