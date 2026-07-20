import {
  divIcon,
  latLngBounds,
  type LatLngExpression,
  type LeafletMouseEvent,
  type Marker as LeafletMarker,
} from "leaflet";
import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polygon,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { FarmPlot } from "../../domain/agriculturalContext";
import type { Position } from "../ndvi/types";

export type Basemap = "satelite" | "mapa";

type MappingMapProps = {
  basemap: Basemap;
  plots: FarmPlot[];
  selectedPlotId: string;
  drawing: boolean;
  points: Position[];
  focusTarget: { center: Position; zoom?: number } | { bounds: Position[] } | null;
  onAddPoint: (position: Position) => void;
  onMovePoint: (index: number, position: Position) => void;
  onSelectPlot: (plotId: string) => void;
};

const vertexIcon = divIcon({
  className: "mapping-vertex-marker",
  html: "<span></span>",
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const ESRI_IMAGERY_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ESRI_ATTRIBUTION =
  "&copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community";

export function MappingMap({
  basemap,
  plots,
  selectedPlotId,
  drawing,
  points,
  focusTarget,
  onAddPoint,
  onMovePoint,
  onSelectPlot,
}: MappingMapProps) {
  return (
    <MapContainer
      center={[-18.94, -46.99]}
      zoom={11}
      minZoom={3}
      maxZoom={19}
      scrollWheelZoom
      className="mapping-leaflet-map"
      aria-label="Mapa de talhões da propriedade"
    >
      {basemap === "satelite" ? (
        <TileLayer attribution={ESRI_ATTRIBUTION} url={ESRI_IMAGERY_URL} maxZoom={19} />
      ) : (
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
      )}

      <DrawingEvents enabled={drawing} onAddPoint={onAddPoint} />
      <FocusController target={focusTarget} />

      {plots.map((plot) => {
        if (!plot.geometry) return null;
        const ring = plot.geometry.coordinates[0].map(
          ([longitude, latitude]) => [latitude, longitude] as LatLngExpression,
        );
        const selected = plot.id === selectedPlotId;
        return (
          <Polygon
            key={plot.id}
            positions={ring}
            pathOptions={{
              color: selected ? "#fbbf24" : "#10b981",
              fillColor: selected ? "#fbbf24" : "#22c55e",
              fillOpacity: selected ? 0.25 : 0.15,
              weight: selected ? 4 : 3,
            }}
            eventHandlers={{ click: () => onSelectPlot(plot.id) }}
          >
            <Tooltip sticky>
              {plot.name} · {plot.areaHectares.toLocaleString("pt-BR")} ha
            </Tooltip>
          </Polygon>
        );
      })}

      {points.length >= 2 && (
        <Polygon
          positions={points.map(([longitude, latitude]) => [latitude, longitude])}
          pathOptions={{
            color: "#0ea5e9",
            fillColor: "#0ea5e9",
            fillOpacity: 0.18,
            weight: 3,
            dashArray: "6 4",
          }}
        />
      )}

      {points.map(([longitude, latitude], index) => (
        <Marker
          key={`${index}-${longitude}-${latitude}`}
          position={[latitude, longitude]}
          icon={vertexIcon}
          draggable
          eventHandlers={{
            dragend: (event) => {
              const marker = event.target as LeafletMarker;
              const position = marker.getLatLng();
              onMovePoint(index, [position.lng, position.lat]);
            },
          }}
        />
      ))}

      {points.length === 1 && (
        <CircleMarker
          center={[points[0][1], points[0][0]]}
          radius={6}
          pathOptions={{ color: "#0ea5e9", fillColor: "#0ea5e9", fillOpacity: 0.9 }}
        />
      )}
    </MapContainer>
  );
}

function FocusController({
  target,
}: {
  target: { center: Position; zoom?: number } | { bounds: Position[] } | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!target) return;
    if ("bounds" in target) {
      if (target.bounds.length === 0) return;
      const bounds = latLngBounds(
        target.bounds.map(([longitude, latitude]) => [latitude, longitude]),
      );
      map.flyToBounds(bounds, { padding: [40, 40], duration: 0.8 });
    } else {
      map.flyTo([target.center[1], target.center[0]], target.zoom ?? 15, {
        duration: 0.8,
      });
    }
  }, [map, target]);

  return null;
}

function DrawingEvents({
  enabled,
  onAddPoint,
}: {
  enabled: boolean;
  onAddPoint: (position: Position) => void;
}) {
  useMapEvents({
    click(event: LeafletMouseEvent) {
      if (enabled) onAddPoint([event.latlng.lng, event.latlng.lat]);
    },
  });

  return null;
}
