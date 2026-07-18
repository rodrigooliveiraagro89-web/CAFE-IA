import { divIcon, type LeafletMouseEvent, type Marker as LeafletMarker } from "leaflet";
import { useEffect } from "react";
import {
  CircleMarker,
  ImageOverlay,
  MapContainer,
  Marker,
  Polygon,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { NdviLayer, Position } from "./types";
import {
  nasaGibsTileUrl,
  NASA_GIBS_ATTRIBUTION,
  NASA_NDVI_LAYER,
  NASA_TRUE_COLOR_LAYER,
} from "./publicLayers";

type NdviMapProps = {
  points: Position[];
  drawing: boolean;
  fullscreen: boolean;
  activeLayer: "true-color" | "ndvi";
  opacity: number;
  ndviLayer?: NdviLayer;
  trueColorLayer?: NdviLayer;
  publicLayerDate: string;
  currentLocation: Position | null;
  onAddPoint: (position: Position) => void;
  onMovePoint: (index: number, position: Position) => void;
};

const vertexIcon = divIcon({
  className: "ndvi-vertex-marker",
  html: "<span></span>",
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

export function NdviMap({
  points,
  drawing,
  fullscreen,
  activeLayer,
  opacity,
  ndviLayer,
  trueColorLayer,
  publicLayerDate,
  currentLocation,
  onAddPoint,
  onMovePoint,
}: NdviMapProps) {
  const selectedLayer = activeLayer === "ndvi" ? ndviLayer : trueColorLayer;
  const publicLayer =
    activeLayer === "ndvi" ? NASA_NDVI_LAYER : NASA_TRUE_COLOR_LAYER;

  return (
    <MapContainer
      center={[-18.94, -46.99]}
      zoom={11}
      minZoom={3}
      maxZoom={19}
      scrollWheelZoom
      className="ndvi-leaflet-map"
      aria-label="Mapa interativo para delimitar o talhão"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {!selectedLayer && (
        <TileLayer
          attribution={NASA_GIBS_ATTRIBUTION}
          url={nasaGibsTileUrl(publicLayer, publicLayerDate)}
          opacity={opacity}
          zIndex={410}
          maxNativeZoom={9}
          maxZoom={19}
        />
      )}

      {selectedLayer?.kind === "tiles" && (
        <TileLayer url={selectedLayer.url} opacity={opacity} zIndex={420} />
      )}
      {selectedLayer?.kind === "image" && selectedLayer.bounds && (
        <ImageOverlay
          url={selectedLayer.url}
          bounds={selectedLayer.bounds}
          opacity={opacity}
          zIndex={420}
        />
      )}

      <DrawingEvents enabled={drawing} onAddPoint={onAddPoint} />
      <ResizeMap fullscreen={fullscreen} />
      <FocusCurrentLocation position={currentLocation} />

      {currentLocation && (
        <CircleMarker
          center={[currentLocation[1], currentLocation[0]]}
          radius={8}
          pathOptions={{
            color: "#ffffff",
            fillColor: "#0ea5e9",
            fillOpacity: 1,
            weight: 3,
          }}
        />
      )}

      {points.length >= 2 && (
        <Polygon
          positions={points.map(([longitude, latitude]) => [latitude, longitude])}
          pathOptions={{
            color: "#10b981",
            fillColor: "#22c55e",
            fillOpacity: selectedLayer ? 0.08 : 0.2,
            weight: 3,
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
    </MapContainer>
  );
}

function FocusCurrentLocation({ position }: { position: Position | null }) {
  const map = useMap();

  useEffect(() => {
    if (!position) return;
    map.flyTo([position[1], position[0]], 15, { duration: 0.8 });
  }, [map, position]);

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

function ResizeMap({ fullscreen }: { fullscreen: boolean }) {
  const map = useMap();

  useEffect(() => {
    const timeout = window.setTimeout(() => map.invalidateSize(), 180);
    return () => window.clearTimeout(timeout);
  }, [fullscreen, map]);

  return null;
}
