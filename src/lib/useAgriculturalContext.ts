import { useEffect, useMemo, useState } from "react";
import {
  emptyAgriculturalContext,
  newId,
  type AgriculturalContextState,
  type FarmPlot,
  type FarmProperty,
  type PlotInput,
  type PropertyInput,
} from "../domain/agriculturalContext";

const STORAGE_KEY = "agryn.agricultural-context.v1";

export type AgriculturalController = {
  state: AgriculturalContextState;
  selectedProperty: FarmProperty | null;
  selectedPlot: FarmPlot | null;
  addProperty: (input: PropertyInput) => string;
  addPlot: (propertyId: string, input: PlotInput) => string;
  selectProperty: (propertyId: string) => void;
  selectPlot: (plotId: string) => void;
  removeProperty: (propertyId: string) => void;
  removePlot: (plotId: string) => void;
};

export function useAgriculturalContext(): AgriculturalController {
  const [state, setState] = useState<AgriculturalContextState>(loadContext);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

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
        const id = newId("property");
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
        return id;
      },
      addPlot(propertyId, input) {
        const id = newId("plot");
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
        return id;
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
      },
    }),
    [selectedPlot, selectedProperty, state],
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
