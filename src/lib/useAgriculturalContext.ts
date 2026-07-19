import { useEffect, useMemo, useRef, useState } from "react";
import {
  emptyAgriculturalContext,
  type AgriculturalContextState,
  type FarmPlot,
  type FarmProperty,
  type PlotInput,
  type PropertyInput,
} from "../domain/agriculturalContext";
import type { GeoPolygon } from "../features/ndvi/types";
import { supabase } from "./supabaseClient";

const STORAGE_KEY = "agryn.agricultural-context.v1";

export type AgriculturalController = {
  state: AgriculturalContextState;
  selectedProperty: FarmProperty | null;
  selectedPlot: FarmPlot | null;
  addProperty: (input: PropertyInput) => string;
  addPlot: (propertyId: string, input: PlotInput) => string;
  updatePlotBoundary: (
    plotId: string,
    geometry: GeoPolygon,
    areaHectares: number,
  ) => void;
  selectProperty: (propertyId: string) => void;
  selectPlot: (plotId: string) => void;
  removeProperty: (propertyId: string) => void;
  removePlot: (plotId: string) => void;
};

type PropertyRow = {
  id: string;
  name: string;
  producer: string;
  responsible: string;
  city: string;
  state: string;
  created_at: string;
};

type PlotRow = {
  id: string;
  property_id: string;
  name: string;
  crop: string;
  variety: string;
  season: string;
  planting_date: string;
  phenological_stage: string;
  row_spacing: string;
  plant_spacing: string;
  population: string;
  area_hectares: number;
  geometry: GeoPolygon | null;
  created_at: string;
};

function propertyFromRow(row: PropertyRow): FarmProperty {
  return {
    id: row.id,
    name: row.name,
    producer: row.producer,
    responsible: row.responsible,
    city: row.city,
    state: row.state,
    createdAt: row.created_at,
  };
}

function plotFromRow(row: PlotRow): FarmPlot {
  return {
    id: row.id,
    propertyId: row.property_id,
    name: row.name,
    crop: row.crop,
    variety: row.variety,
    season: row.season,
    plantingDate: row.planting_date,
    phenologicalStage: row.phenological_stage,
    rowSpacing: row.row_spacing,
    plantSpacing: row.plant_spacing,
    population: row.population,
    areaHectares: Number(row.area_hectares),
    geometry: row.geometry,
    createdAt: row.created_at,
  };
}

function logSyncError(action: string, error: { message: string } | null) {
  if (error) console.error(`[agryn] falha ao sincronizar ${action}:`, error.message);
}

export function useAgriculturalContext(userId: string | null = null): AgriculturalController {
  const [state, setState] = useState<AgriculturalContextState>(loadContext);
  const previousUserId = useRef<string | null>(null);

  // Cache local para carregamento instantâneo — deixa de ser fonte de verdade
  // assim que há uma conta logada (a nuvem manda).
  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Ao logar, busca propriedades e talhões reais da conta.
  // Ao deslogar, limpa o cache local para não vazar dado de uma conta pra
  // sessão seguinte no mesmo navegador.
  useEffect(() => {
    if (!userId) {
      if (previousUserId.current) {
        window.localStorage.removeItem(STORAGE_KEY);
        setState(emptyAgriculturalContext);
      }
      previousUserId.current = null;
      return;
    }
    previousUserId.current = userId;

    let active = true;
    (async () => {
      const [propertiesResult, plotsResult] = await Promise.all([
        supabase.from("properties").select("*").order("created_at", { ascending: true }),
        supabase.from("plots").select("*").order("created_at", { ascending: true }),
      ]);
      if (!active) return;
      logSyncError("propriedades", propertiesResult.error);
      logSyncError("talhões", plotsResult.error);
      const properties = ((propertiesResult.data as PropertyRow[] | null) ?? []).map(propertyFromRow);
      const plots = ((plotsResult.data as PlotRow[] | null) ?? []).map(plotFromRow);
      setState((current) => {
        const selectedPropertyId = properties.some((property) => property.id === current.selectedPropertyId)
          ? current.selectedPropertyId
          : (properties[0]?.id ?? "");
        const selectedPlotId = plots.some(
          (plot) => plot.id === current.selectedPlotId && plot.propertyId === selectedPropertyId,
        )
          ? current.selectedPlotId
          : (plots.find((plot) => plot.propertyId === selectedPropertyId)?.id ?? "");
        return { properties, plots, selectedPropertyId, selectedPlotId };
      });
    })();

    return () => {
      active = false;
    };
  }, [userId]);

  const selectedProperty =
    state.properties.find((property) => property.id === state.selectedPropertyId) ?? null;
  const selectedPlot =
    state.plots.find(
      (plot) =>
        plot.id === state.selectedPlotId && plot.propertyId === state.selectedPropertyId,
    ) ?? null;

  return useMemo(
    () => ({
      state,
      selectedProperty,
      selectedPlot,
      addProperty(input) {
        const id = crypto.randomUUID();
        const property: FarmProperty = {
          ...input,
          id,
          createdAt: new Date().toISOString(),
        };
        setState((current) => ({
          ...current,
          properties: [...current.properties, property],
          selectedPropertyId: id,
          selectedPlotId: "",
        }));
        if (userId) {
          supabase
            .from("properties")
            .insert({ id, user_id: userId, ...input })
            .then(({ error }) => logSyncError("propriedade nova", error));
        }
        return id;
      },
      addPlot(propertyId, input) {
        const id = crypto.randomUUID();
        const plot: FarmPlot = {
          ...input,
          id,
          propertyId,
          createdAt: new Date().toISOString(),
        };
        setState((current) => ({
          ...current,
          plots: [...current.plots, plot],
          selectedPropertyId: propertyId,
          selectedPlotId: id,
        }));
        if (userId) {
          supabase
            .from("plots")
            .insert({
              id,
              user_id: userId,
              property_id: propertyId,
              name: input.name,
              crop: input.crop,
              variety: input.variety,
              season: input.season,
              planting_date: input.plantingDate,
              phenological_stage: input.phenologicalStage,
              row_spacing: input.rowSpacing,
              plant_spacing: input.plantSpacing,
              population: input.population,
              area_hectares: input.areaHectares,
              geometry: input.geometry,
            })
            .then(({ error }) => logSyncError("talhão novo", error));
        }
        return id;
      },
      updatePlotBoundary(plotId, geometry, areaHectares) {
        setState((current) => ({
          ...current,
          plots: current.plots.map((plot) =>
            plot.id === plotId
              ? {
                  ...plot,
                  geometry,
                  areaHectares,
                }
              : plot,
          ),
        }));
        if (userId) {
          supabase
            .from("plots")
            .update({ geometry, area_hectares: areaHectares })
            .eq("id", plotId)
            .then(({ error }) => logSyncError("limite do talhão", error));
        }
      },
      selectProperty(propertyId) {
        setState((current) => ({
          ...current,
          selectedPropertyId: propertyId,
          selectedPlotId:
            current.plots.find((plot) => plot.propertyId === propertyId)?.id ?? "",
        }));
      },
      selectPlot(plotId) {
        setState((current) => {
          const plot = current.plots.find((candidate) => candidate.id === plotId);
          return plot
            ? {
                ...current,
                selectedPropertyId: plot.propertyId,
                selectedPlotId: plotId,
              }
            : current;
        });
      },
      removeProperty(propertyId) {
        setState((current) => {
          const properties = current.properties.filter((property) => property.id !== propertyId);
          const plots = current.plots.filter((plot) => plot.propertyId !== propertyId);
          const selectedPropertyId =
            current.selectedPropertyId === propertyId
              ? (properties[0]?.id ?? "")
              : current.selectedPropertyId;
          return {
            properties,
            plots,
            selectedPropertyId,
            selectedPlotId:
              plots.find((plot) => plot.propertyId === selectedPropertyId)?.id ?? "",
          };
        });
        if (userId) {
          supabase
            .from("properties")
            .delete()
            .eq("id", propertyId)
            .then(({ error }) => logSyncError("remoção da propriedade", error));
        }
      },
      removePlot(plotId) {
        setState((current) => {
          const plots = current.plots.filter((plot) => plot.id !== plotId);
          return {
            ...current,
            plots,
            selectedPlotId:
              current.selectedPlotId === plotId
                ? (plots.find((plot) => plot.propertyId === current.selectedPropertyId)?.id ?? "")
                : current.selectedPlotId,
          };
        });
        if (userId) {
          supabase
            .from("plots")
            .delete()
            .eq("id", plotId)
            .then(({ error }) => logSyncError("remoção do talhão", error));
        }
      },
    }),
    [selectedPlot, selectedProperty, state, userId],
  );
}

function loadContext(): AgriculturalContextState {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    if (
      value &&
      Array.isArray(value.properties) &&
      Array.isArray(value.plots) &&
      typeof value.selectedPropertyId === "string" &&
      typeof value.selectedPlotId === "string"
    ) {
      return value as AgriculturalContextState;
    }
  } catch {
    // A malformed local value must never prevent the platform from opening.
  }
  return emptyAgriculturalContext;
}
