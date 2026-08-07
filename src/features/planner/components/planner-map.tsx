import "mapbox-gl/dist/mapbox-gl.css";

import { ChevronRight, MapPinned, Scan } from "lucide-react";
import mapboxgl, { type GeoJSONSource, type Map as MapboxMap } from "mapbox-gl";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { env } from "@/config/env";
import { buildPlannerMapModel } from "@/features/planner/map/build-planner-map-model";
import type {
  PlannerMapFocus,
  PlannerMapMarker,
  PlannerMapModel,
  PlannerMapRoute,
} from "@/features/planner/map/planner-map-model";
import { usePlannerMapStore } from "@/features/planner/stores/planner-map-store";
import { usePlannerViewStore } from "@/features/planner/stores/planner-view-store";

const MAP_STYLE = "mapbox://styles/mapbox/standard";
const DEFAULT_CENTER: [longitude: number, latitude: number] = [126.5312, 33.4996];
const DEFAULT_ZOOM = 9;
const SINGLE_MARKER_ZOOM = 13;
const FOCUSED_MARKER_ZOOM = 14;
const CAMERA_ANIMATION_DURATION = 500;
const FOCUS_PADDING = 80;
const ROUTE_SOURCE_ID = "planner-routes";
const ROUTE_BORDER_LAYER_ID = "planner-route-borders";
const ROUTE_LAYER_ID = "planner-route-lines";
const MARKER_PIN_RADIUS = 16;
const MAP_LOAD_TIMEOUT_MS = 10_000;

type MapLoadState = "loading" | "ready" | "error";

type RenderedMarker = {
  readonly marker: mapboxgl.Marker;
  readonly element: HTMLDivElement;
  readonly label: HTMLSpanElement;
  readonly pin: HTMLSpanElement;
};

type PlannerRoutesGeoJson = {
  readonly type: "FeatureCollection";
  readonly features: Array<{
    readonly type: "Feature";
    readonly properties: {
      readonly dayPathId: string;
      readonly color: string;
      readonly opacity: number;
    };
    readonly geometry: {
      readonly type: "LineString";
      readonly coordinates: number[][];
    };
  }>;
};

function toRoutesGeoJson(routes: readonly PlannerMapRoute[]): PlannerRoutesGeoJson {
  return {
    type: "FeatureCollection",
    features: routes.map((route) => ({
      type: "Feature",
      properties: {
        dayPathId: route.dayPathId,
        color: route.color,
        opacity: route.opacity,
      },
      geometry: {
        type: "LineString",
        coordinates: route.coordinates.map((coordinate) => [...coordinate]),
      },
    })),
  };
}

function createMarkerElement(): Omit<RenderedMarker, "marker"> {
  const element = document.createElement("div");
  element.className = "pointer-events-none transition-opacity";
  element.setAttribute("aria-hidden", "true");

  const content = document.createElement("div");
  content.className = "flex flex-col items-center gap-1";

  const label = document.createElement("span");
  label.className =
    "max-w-40 truncate rounded bg-white/90 px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap shadow-sm";

  const pin = document.createElement("span");
  pin.className =
    "flex size-8 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow-md transition-transform duration-200";

  content.append(label, pin);
  element.append(content);
  return { element, label, pin };
}

function updateMarker(renderedMarker: RenderedMarker, markerModel: PlannerMapMarker): void {
  renderedMarker.marker.setLngLat([...markerModel.coordinate]);
  renderedMarker.element.style.opacity = String(markerModel.opacity);
  renderedMarker.element.style.zIndex = markerModel.isSelected ? "10" : "0";
  renderedMarker.label.textContent = markerModel.name;
  renderedMarker.label.style.color = markerModel.color;
  renderedMarker.pin.textContent = String(markerModel.number);
  renderedMarker.pin.style.backgroundColor = markerModel.color;
  renderedMarker.pin.style.transform = markerModel.isSelected ? "scale(1.2)" : "scale(1)";
}

function syncMarkers({
  map,
  markers,
  renderedMarkers,
}: {
  readonly map: MapboxMap;
  readonly markers: readonly PlannerMapMarker[];
  readonly renderedMarkers: Map<string, RenderedMarker>;
}): void {
  const activePathIds = new Set(markers.map((marker) => marker.pathId));

  renderedMarkers.forEach((renderedMarker, pathId) => {
    if (!activePathIds.has(pathId)) {
      renderedMarker.marker.remove();
      renderedMarkers.delete(pathId);
    }
  });

  markers.forEach((markerModel) => {
    let renderedMarker = renderedMarkers.get(markerModel.pathId);

    if (!renderedMarker) {
      const markerElement = createMarkerElement();
      const marker = new mapboxgl.Marker({
        element: markerElement.element,
        anchor: "bottom",
        offset: [0, MARKER_PIN_RADIUS],
      })
        .setLngLat([...markerModel.coordinate])
        .addTo(map);
      renderedMarker = { marker, ...markerElement };
      renderedMarkers.set(markerModel.pathId, renderedMarker);
    }

    updateMarker(renderedMarker, markerModel);
  });
}

function syncRoutes(map: MapboxMap, routes: readonly PlannerMapRoute[]): void {
  const source = map.getSource(ROUTE_SOURCE_ID) as GeoJSONSource | undefined;
  source?.setData(toRoutesGeoJson(routes));
}

function addRouteLayers(map: MapboxMap): void {
  map.addSource(ROUTE_SOURCE_ID, {
    type: "geojson",
    data: toRoutesGeoJson([]),
  });
  map.addLayer({
    id: ROUTE_BORDER_LAYER_ID,
    type: "line",
    source: ROUTE_SOURCE_ID,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": "#FFFFFF",
      "line-width": 8,
      "line-opacity": ["get", "opacity"],
    },
  });
  map.addLayer({
    id: ROUTE_LAYER_ID,
    type: "line",
    source: ROUTE_SOURCE_ID,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": ["get", "color"],
      "line-width": 4,
      "line-opacity": ["get", "opacity"],
    },
  });
}

function applyInitialCamera(map: MapboxMap, model: PlannerMapModel): boolean {
  const coordinates = model.markers.map((marker) => marker.coordinate);

  if (coordinates.length === 0) {
    map.setCenter(DEFAULT_CENTER);
    map.setZoom(DEFAULT_ZOOM);
    return false;
  }

  if (coordinates.length === 1) {
    map.setCenter([...coordinates[0]]);
    map.setZoom(SINGLE_MARKER_ZOOM);
    return true;
  }

  const [firstLongitude, firstLatitude] = coordinates[0];
  const [west, south, east, north] = coordinates.reduce(
    ([west, south, east, north], [longitude, latitude]) => [
      Math.min(west, longitude),
      Math.min(south, latitude),
      Math.max(east, longitude),
      Math.max(north, latitude),
    ],
    [firstLongitude, firstLatitude, firstLongitude, firstLatitude],
  );

  map.fitBounds(
    [
      [west, south],
      [east, north],
    ],
    {
      padding: { top: 60, right: 60, bottom: 60, left: 60 },
      maxZoom: 14,
      duration: 0,
    },
  );
  return true;
}

function focusMap(map: MapboxMap, focus: PlannerMapFocus): void {
  if (focus.kind === "point" || focus.coordinates.length === 1) {
    map.easeTo({
      center: [...focus.coordinates[0]],
      zoom: Math.max(map.getZoom(), FOCUSED_MARKER_ZOOM),
      duration: CAMERA_ANIMATION_DURATION,
    });
    return;
  }

  const [firstLongitude, firstLatitude] = focus.coordinates[0];
  const [west, south, east, north] = focus.coordinates.reduce(
    ([west, south, east, north], [longitude, latitude]) => [
      Math.min(west, longitude),
      Math.min(south, latitude),
      Math.max(east, longitude),
      Math.max(north, latitude),
    ],
    [firstLongitude, firstLatitude, firstLongitude, firstLatitude],
  );

  map.fitBounds(
    [
      [west, south],
      [east, north],
    ],
    {
      padding: FOCUS_PADDING,
      maxZoom: FOCUSED_MARKER_ZOOM,
      duration: CAMERA_ANIMATION_DURATION,
    },
  );
}

export function PlannerMap({ accessToken }: { readonly accessToken?: string | null }) {
  const tree = usePlannerViewStore((state) => state.tree);
  const selectedItemId = usePlannerViewStore((state) => state.selectedItemId);
  const selectionRevision = usePlannerViewStore((state) => state.selectionRevision);
  const isModuleCollapsed = usePlannerViewStore((state) => state.isModuleCollapsed);
  const setModuleCollapsed = usePlannerViewStore((state) => state.setModuleCollapsed);
  const hiddenDayIds = usePlannerMapStore((state) => state.hiddenDayIds);
  const resolvedAccessToken = accessToken === undefined ? env.mapboxAccessToken : accessToken;
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const [mapLoadState, setMapLoadState] = useState<MapLoadState>("loading");
  const [retryCount, setRetryCount] = useState(0);
  const isLoadedRef = useRef(false);
  const hasAppliedInitialCameraRef = useRef(false);
  const lastFocusRevisionRef = useRef(-1);
  const renderedMarkersRef = useRef(new Map<string, RenderedMarker>());
  const mapModel = useMemo(
    () => buildPlannerMapModel({ tree, hiddenDayIds, selectedItemId }),
    [hiddenDayIds, selectedItemId, tree],
  );
  const mapModelRef = useRef(mapModel);
  const selectionRevisionRef = useRef(selectionRevision);

  useEffect(() => {
    mapModelRef.current = mapModel;
    selectionRevisionRef.current = selectionRevision;
  }, [mapModel, selectionRevision]);

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || !resolvedAccessToken) {
      return;
    }

    setMapLoadState("loading");
    let map: MapboxMap;
    try {
      map = new mapboxgl.Map({
        accessToken: resolvedAccessToken,
        container,
        style: MAP_STYLE,
        config: { basemap: { lightPreset: "day" } },
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
      });
    } catch {
      const constructorErrorTimeoutId = window.setTimeout(() => {
        setMapLoadState("error");
      }, 0);
      return () => {
        window.clearTimeout(constructorErrorTimeoutId);
      };
    }

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");
    const renderedMarkers = renderedMarkersRef.current;
    mapRef.current = map;
    let isDisposed = false;
    let hasInitialLoadFailed = false;
    let loadTimeoutId = window.setTimeout(() => {
      if (!isDisposed && !isLoadedRef.current) {
        hasInitialLoadFailed = true;
        setMapLoadState("error");
      }
    }, MAP_LOAD_TIMEOUT_MS);

    const clearLoadTimeout = () => {
      window.clearTimeout(loadTimeoutId);
      loadTimeoutId = 0;
    };

    const handleLoad = () => {
      if (hasInitialLoadFailed) {
        return;
      }

      clearLoadTimeout();
      isLoadedRef.current = true;
      setMapLoadState("ready");
      addRouteLayers(map);
      syncRoutes(map, mapModelRef.current.routes);
      syncMarkers({
        map,
        markers: mapModelRef.current.markers,
        renderedMarkers,
      });
      hasAppliedInitialCameraRef.current = applyInitialCamera(map, mapModelRef.current);
      if (mapModelRef.current.focus) {
        focusMap(map, mapModelRef.current.focus);
      }
      lastFocusRevisionRef.current = selectionRevisionRef.current;
    };

    const handleError = () => {
      if (isLoadedRef.current || hasInitialLoadFailed) {
        return;
      }

      clearLoadTimeout();
      hasInitialLoadFailed = true;
      setMapLoadState("error");
    };

    map.on("load", handleLoad);
    map.on("error", handleError);

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            map.resize();
          });
    resizeObserver?.observe(container);

    return () => {
      isDisposed = true;
      clearLoadTimeout();
      resizeObserver?.disconnect();
      renderedMarkers.forEach(({ marker }) => {
        marker.remove();
      });
      renderedMarkers.clear();
      map.remove();
      mapRef.current = null;
      isLoadedRef.current = false;
      hasAppliedInitialCameraRef.current = false;
      lastFocusRevisionRef.current = -1;
    };
  }, [resolvedAccessToken, retryCount]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoadedRef.current) {
      return;
    }

    syncRoutes(map, mapModel.routes);
    syncMarkers({ map, markers: mapModel.markers, renderedMarkers: renderedMarkersRef.current });

    if (!hasAppliedInitialCameraRef.current) {
      hasAppliedInitialCameraRef.current = applyInitialCamera(map, mapModel);
    }

    if (!mapModel.focus) {
      lastFocusRevisionRef.current = selectionRevision;
      return;
    }

    if (lastFocusRevisionRef.current !== selectionRevision) {
      focusMap(map, mapModel.focus);
      lastFocusRevisionRef.current = selectionRevision;
    }
  }, [mapModel, selectionRevision]);

  return (
    <section
      aria-label="지도 영역"
      className="relative h-full min-w-0 flex-1 overflow-hidden bg-[#eef1f3]"
    >
      {resolvedAccessToken ? (
        <div className="absolute inset-0">
          <div ref={mapContainerRef} data-testid="planner-map-canvas" className="h-full w-full" />
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center p-8">
          <div className="max-w-sm rounded-xl border bg-card/95 p-5 text-center shadow-sm">
            <MapPinned aria-hidden="true" className="mx-auto mb-3 size-7 text-brand" />
            <p className="font-semibold">Mapbox 토큰이 필요합니다</p>
            <p className="mt-1 text-sm text-muted-foreground">
              VITE_MAPBOX_ACCESS_TOKEN을 설정하면 일정 마커와 경로가 표시됩니다.
            </p>
          </div>
        </div>
      )}
      {resolvedAccessToken && mapLoadState === "loading" ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#eef1f3]/85 p-8">
          <p role="status" className="text-sm font-medium text-muted-foreground">
            지도를 불러오는 중입니다
          </p>
        </div>
      ) : null}
      {resolvedAccessToken && mapLoadState === "error" ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#eef1f3]/95 p-8">
          <div
            role="alert"
            className="max-w-sm rounded-xl border bg-card p-5 text-center shadow-sm"
          >
            <MapPinned aria-hidden="true" className="mx-auto mb-3 size-7 text-brand" />
            <p className="font-semibold">지도를 불러오지 못했습니다</p>
            <p className="mt-1 text-sm text-muted-foreground">
              토큰과 네트워크 연결을 확인한 뒤 다시 시도해 주세요.
            </p>
            <Button
              type="button"
              variant="secondary"
              className="mt-4"
              onClick={() => {
                setMapLoadState("loading");
                setRetryCount((count) => count + 1);
              }}
            >
              지도 다시 시도
            </Button>
          </div>
        </div>
      ) : null}
      {resolvedAccessToken && mapLoadState === "ready" ? (
        <div className="absolute top-3 right-12 z-10">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            title="전체 일정 보기"
            aria-label="전체 일정 보기"
            className="shadow-sm"
            onClick={() => {
              const map = mapRef.current;
              if (map && isLoadedRef.current) {
                applyInitialCamera(map, mapModelRef.current);
              }
            }}
          >
            <Scan aria-hidden="true" className="size-4" />
          </Button>
        </div>
      ) : null}
      {isModuleCollapsed ? (
        <div className="absolute top-4 left-4 z-10">
          <Button
            type="button"
            variant="secondary"
            className="shadow-sm"
            onClick={() => {
              setModuleCollapsed(false);
            }}
          >
            <ChevronRight aria-hidden="true" className="size-4" />
            패널 열기
          </Button>
        </div>
      ) : null}
    </section>
  );
}
