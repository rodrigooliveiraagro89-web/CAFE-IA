import {
  divIcon,
  latLngBounds,
  type LatLngExpression,
  type LeafletMouseEvent,
  type Marker as LeafletMarker,
} from "leaflet";
import { useEffect } from "react";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { FarmPlot } from "../../domain/agriculturalContext";
import { plotColor } from "../../domain/plotColor";
import type { Position } from "../ndvi/types";

export type Basemap = "satelite" | "mapa" | "hibrido" | "relevo";
export type MeasureMode = "area" | "distancia";

export type LiveLocation = {
  position: Position;
  accuracy: number;
};

type MappingMapProps = {
  basemap: Basemap;
  mode: MeasureMode;
  precision: boolean;
  plots: FarmPlot[];
  selectedPlotId: string;
  drawing: boolean;
  points: Position[];
  focusTarget: { center: Position; zoom?: number } | { bounds: Position[] } | null;
  liveLocation: LiveLocation | null;
  follow: boolean;
  onAddPoint: (position: Position) => void;
  onMovePoint: (index: number, position: Position) => void;
  onSelectPlot: (plotId: string) => void;
  onCenterChange: (center: Position) => void;
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
const ESRI_REFERENCE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
const OPENTOPO_URL = "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png";
const OPENTOPO_ATTRIBUTION =
  '&copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA), &copy; OpenStreetMap';

function Basemaps({ basemap }: { basemap: Basemap }) {
  if (basemap === "mapa") {
    return (
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
    );
  }
  if (basemap === "relevo") {
    return <TileLayer attribution={OPENTOPO_ATTRIBUTION} url={OPENTOPO_URL} maxZoom={17} />;
  }
  // satelite e hibrido usam a imagem Esri; o híbrido adiciona rótulos por cima.
  return (
    <>
      <TileLayer attribution={ESRI_ATTRIBUTION} url={ESRI_IMAGERY_URL} maxZoom={19} />
      {basemap === "hibrido" && <TileLayer url={ESRI_REFERENCE_URL} maxZoom={19} />}
    </>
  );
}

export function MappingMap({
  basemap,
  mode,
  precision,
  plots,
  selectedPlotId,
  drawing,
  points,
  focusTarget,
  liveLocation,
  follow,
  onAddPoint,
  onMovePoint,
  onSelectPlot,
  onCenterChange,
}: MappingMapProps) {
  const isDistance = mode === "distancia";
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
      <Basemaps basemap={basemap} />

      <DrawingEvents enabled={drawing && !precision} onAddPoint={onAddPoint} />
      <CenterTracker onCenterChange={onCenterChange} />
      <FocusController target={focusTarget} />
      <FollowController location={liveLocation} follow={follow} />

      {plots.map((plot) => {
        if (!plot.geometry) return null;
        const ring = plot.geometry.coordinates[0].map(
          ([longitude, latitude]) => [latitude, longitude] as LatLngExpression,
        );
        const selected = plot.id === selectedPlotId;
        const color = plotColor(plot.id);
        return (
          <Polygon
            key={plot.id}
            positions={ring}
            pathOptions={{
              color: selected ? "#fbbf24" : color,
              fillColor: selected ? "#fbbf24" : color,
              fillOpacity: selected ? 0.28 : 0.18,
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

      {/* Desenho em andamento: polígono (área) ou linha (distância). */}
      {isDistance
        ? points.length >= 2 && (
            <Polyline
              positions={points.map(([longitude, latitude]) => [latitude, longitude])}
              pathOptions={{ color: "#0ea5e9", weight: 4 }}
            />
          )
        : points.length >= 2 && (
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

      {liveLocation && (
        <>
          <Circle
            center={[liveLocation.position[1], liveLocation.position[0]]}
            radius={Math.max(liveLocation.accuracy, 1)}
            pathOptions={{
              color: "#0ea5e9",
              fillColor: "#0ea5e9",
              fillOpacity: 0.12,
              weight: 1,
            }}
          />
          <CircleMarker
            center={[liveLocation.position[1], liveLocation.position[0]]}
            radius={8}
            pathOptions={{
              color: "#ffffff",
              fillColor: "#2563eb",
              fillOpacity: 1,
              weight: 3,
            }}
          />
          {points.length > 0 && (
            <Polyline
              positions={[
                [points[points.length - 1][1], points[points.length - 1][0]],
                [liveLocation.position[1], liveLocation.position[0]],
              ]}
              pathOptions={{ color: "#2563eb", weight: 2, dashArray: "4 6", opacity: 0.7 }}
            />
          )}
        </>
      )}
    </MapContainer>
  );
}

function CenterTracker({ onCenterChange }: { onCenterChange: (center: Position) => void }) {
  const map = useMap();
  useEffect(() => {
    const center = map.getCenter();
    onCenterChange([center.lng, center.lat]);
  }, [map, onCenterChange]);
  useMapEvents({
    move() {
      const center = map.getCenter();
      onCenterChange([center.lng, center.lat]);
    },
  });
  return null;
}

function FollowController({
  location,
  follow,
}: {
  location: LiveLocation | null;
  follow: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (!follow || !location) return;
    map.panTo([location.position[1], location.position[0]], { animate: true });
  }, [map, follow, location]);

  return null;
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
