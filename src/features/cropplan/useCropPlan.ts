import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { logSyncError } from "../../lib/syncError";
import { enqueueDelete, enqueueWrite, pendingIds } from "../../lib/syncOutbox";
import type { CropPlan, CropPlanItem, CropPlanStatus } from "../../domain/cropPlan";

const STORAGE_KEY = "agryn.cropplans.v1";

type CropPlanRow = {
  id: string;
  property_id: string;
  plot_id: string;
  safra: string;
  title: string;
  status: CropPlanStatus;
  items: CropPlanItem[] | null;
  created_at: string;
  updated_at: string;
};

function planFromRow(row: CropPlanRow): CropPlan {
  return {
    id: row.id,
    propertyId: row.property_id,
    plotId: row.plot_id,
    safra: row.safra,
    title: row.title,
    status: row.status,
    items: Array.isArray(row.items) ? row.items : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function persist(plan: CropPlan, userId: string) {
  // Outbox durável: plano criado/editado offline sincroniza ao reconectar.
  enqueueWrite({
    id: `crop_plans:${plan.id}`,
    table: "crop_plans",
    onConflict: "id",
    label: "plano de safra",
    payload: {
      id: plan.id,
      user_id: userId,
      property_id: plan.propertyId,
      plot_id: plan.plotId,
      safra: plan.safra,
      title: plan.title,
      status: plan.status,
      items: plan.items,
      updated_at: plan.updatedAt,
    },
  });
}

export type NewCropPlan = {
  propertyId: string;
  plotId: string;
  safra: string;
  title: string;
  items: CropPlanItem[];
  status?: CropPlanStatus;
};

export type CropPlanPatch = Partial<Pick<CropPlan, "items" | "title" | "status" | "safra">>;

export type CropPlanController = {
  plans: CropPlan[];
  addPlan(input: NewCropPlan): CropPlan;
  updatePlan(planId: string, patch: CropPlanPatch): void;
  addItem(planId: string, item: CropPlanItem): void;
  patchItem(planId: string, itemId: string, patch: Partial<CropPlanItem>): void;
  removeItem(planId: string, itemId: string): void;
  removePlan(planId: string): void;
};

export function useCropPlans(userId: string | null = null): CropPlanController {
  const [plans, setPlans] = useState<CropPlan[]>(loadPlans);
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
  }, [plans]);

  // Mesmo padrão de useFieldRecords: cache local para abrir na hora, nuvem manda
  // quando há conta logada, e limpa o cache ao deslogar (não vaza plano de uma
  // conta para outra no mesmo navegador).
  useEffect(() => {
    if (!userId) {
      if (previousUserId.current) {
        window.localStorage.removeItem(STORAGE_KEY);
        setPlans([]);
      }
      previousUserId.current = null;
      return;
    }
    previousUserId.current = userId;

    let active = true;
    supabase
      .from("crop_plans")
      .select("id, property_id, plot_id, safra, title, status, items, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;
        logSyncError("planos de safra", error);
        if (error) return;
        // Merge: preserva SÓ os planos locais ainda pendentes na outbox que a
        // nuvem não conhece (criados offline, ou flush ainda não concluído).
        const cloud = ((data as CropPlanRow[] | null) ?? []).map(planFromRow);
        const pend = pendingIds();
        setPlans((local) => {
          const cloudIds = new Set(cloud.map((plan) => plan.id));
          const pendentes = local.filter(
            (plan) => !cloudIds.has(plan.id) && pend.has(`crop_plans:${plan.id}`),
          );
          return [...pendentes, ...cloud];
        });
      });

    return () => {
      active = false;
    };
  }, [userId]);

  // Reconcilia SEMPRE sobre o estado CURRENT (dentro do setPlans funcional) —
  // nunca sobre um snapshot de render. Sem isso, duas conclusões concorrentes
  // (cada uma partindo de um `plan` capturado no closure) sobrescreveriam uma à
  // outra (lost update), agravado pela janela do await ao registrar no caderno.
  const applyToPlan = (planId: string, mutate: (plan: CropPlan) => CropPlan) => {
    const now = new Date().toISOString();
    setPlans((current) => {
      const next = current.map((plan) => (plan.id === planId ? { ...mutate(plan), updatedAt: now } : plan));
      const updated = next.find((plan) => plan.id === planId);
      if (updated && userId) persist(updated, userId);
      return next;
    });
  };

  return {
    plans,
    addPlan(input) {
      const now = new Date().toISOString();
      const plan: CropPlan = {
        id: crypto.randomUUID(),
        propertyId: input.propertyId,
        plotId: input.plotId,
        safra: input.safra,
        title: input.title,
        status: input.status ?? "ativo",
        items: input.items,
        createdAt: now,
        updatedAt: now,
      };
      setPlans((current) => [plan, ...current]);
      if (userId) persist(plan, userId);
      return plan;
    },
    updatePlan(planId, patch) {
      applyToPlan(planId, (plan) => ({ ...plan, ...patch }));
    },
    addItem(planId, item) {
      applyToPlan(planId, (plan) => ({ ...plan, items: [...plan.items, item] }));
    },
    patchItem(planId, itemId, patch) {
      applyToPlan(planId, (plan) => ({
        ...plan,
        items: plan.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)),
      }));
    },
    removeItem(planId, itemId) {
      applyToPlan(planId, (plan) => ({ ...plan, items: plan.items.filter((i) => i.id !== itemId) }));
    },
    removePlan(planId) {
      // Remoção durável pela outbox: funciona offline (enfileira e apaga ao
      // reconectar) e não ressuscita por blip de rede. A MESMA chave de dedup do
      // upsert garante que um create/update pendente do plano seja substituído
      // pelo delete.
      setPlans((current) => current.filter((plan) => plan.id !== planId));
      if (userId) {
        enqueueDelete({
          id: `crop_plans:${planId}`,
          table: "crop_plans",
          match: { id: planId },
          label: "remoção do plano de safra",
        });
      }
    },
  };
}

function loadPlans(): CropPlan[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}
