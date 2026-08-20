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
import {
  type PlannerRouteHoverProgress,
  stepPlannerRouteHoverProgress,
} from "@/features/planner/map/planner-route-hover-progress";
import { usePlannerMapStore } from "@/features/planner/stores/planner-map-store";
import { usePlannerViewStore } from "@/features/planner/stores/planner-view-store";
import type { PlannerNodePathId } from "@/features/planner/types/planner-node";

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
  readonly element: HTMLButtonElement;
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
      readonly isHovered: boolean;
      readonly hoverProgress: number;
    };
    readonly geometry: {
      readonly type: "LineString";
      readonly coordinates: number[][];
    };
  }>;
};

function toRoutesGeoJson(
  routes: readonly PlannerMapRoute[],
  hoverProgress: PlannerRouteHoverProgress,
): PlannerRoutesGeoJson {
  return {
    type: "FeatureCollection",
    features: routes.map((route) => ({
      type: "Feature",
      properties: {
        dayPathId: route.dayPathId,
        color: route.color,
        opacity: route.opacity,
        isHovered: route.isHovered,
        hoverProgress: hoverProgress.get(route.dayPathId) ?? (route.isHovered ? 1 : 0),
      },
      geometry: {
        type: "LineString",
        coordinates: route.coordinates.map((coordinate) => [...coordinate]),
      },
    })),
  };
}

function createMarkerElement(): Omit<RenderedMarker, "marker"> {
  const element = document.createElement("button");
  element.type = "button";
  element.className =
    "pointer-events-auto cursor-pointer border-0 bg-transparent p-0 transition-opacity";

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
  const isEmphasized = markerModel.isSelected || markerModel.isHovered;
  renderedMarker.marker.setLngLat([...markerModel.coordinate]);
  renderedMarker.element.style.opacity = String(markerModel.opacity);
  renderedMarker.element.style.zIndex = isEmphasized ? "10" : "0";
  renderedMarker.element.setAttribute("aria-label", `${markerModel.name} 일정 선택`);
  renderedMarker.label.textContent = markerModel.name;
  renderedMarker.label.style.color = markerModel.color;
  renderedMarker.pin.textContent = String(markerModel.number);
  renderedMarker.pin.style.backgroundColor = markerModel.color;
  renderedMarker.pin.style.transform = isEmphasized ? "scale(1.35)" : "scale(1)";
}

// 마커 엘리먼트는 canvas container의 자식이라 마커 위 포인터 이동도 지도까지 전달된다.
// 마커 아래에 경로선이 깔려 있으면 지도가 그 선을 hover로 잡아 마커 hover를 덮어쓰므로,
// 마커를 가리키는 동안에는 경로선 hover를 건너뛰도록 현재 hover 중인 마커를 함께 추적한다.
type HoveredMarkerRef = { current: PlannerNodePathId | null };

function syncMarkers({
  map,
  markers,
  renderedMarkers,
  hoveredMarkerRef,
}: {
  readonly map: MapboxMap;
  readonly markers: readonly PlannerMapMarker[];
  readonly renderedMarkers: Map<string, RenderedMarker>;
  readonly hoveredMarkerRef: HoveredMarkerRef;
}): void {
  const activePathIds = new Set(markers.map((marker) => marker.pathId));

  renderedMarkers.forEach((renderedMarker, pathId) => {
    if (!activePathIds.has(pathId)) {
      if (hoveredMarkerRef.current === pathId) {
        hoveredMarkerRef.current = null;
      }
      renderedMarker.marker.remove();
      renderedMarkers.delete(pathId);
    }
  });

  markers.forEach((markerModel) => {
    let renderedMarker = renderedMarkers.get(markerModel.pathId);

    if (!renderedMarker) {
      const markerElement = createMarkerElement();
      markerElement.element.addEventListener("click", (event) => {
        // 마커 아래에 경로선이 깔려 있으면 지도 click까지 이어져 Day가 대신 선택된다.
        event.stopPropagation();
        usePlannerViewStore.getState().activateItem(markerModel.pathId);
      });
      markerElement.element.addEventListener("pointerenter", () => {
        hoveredMarkerRef.current = markerModel.pathId;
        usePlannerViewStore.getState().setHoveredItem(markerModel.pathId);
      });
      markerElement.element.addEventListener("pointerleave", () => {
        if (hoveredMarkerRef.current === markerModel.pathId) {
          hoveredMarkerRef.current = null;
        }
        const state = usePlannerViewStore.getState();
        if (state.hoveredItemId === markerModel.pathId) {
          state.setHoveredItem(null);
        }
      });
      markerElement.element.addEventListener("pointerdown", (event) => event.stopPropagation());
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

function syncRoutes(
  map: MapboxMap,
  routes: readonly PlannerMapRoute[],
  hoverProgress: PlannerRouteHoverProgress,
): void {
  const source = map.getSource(ROUTE_SOURCE_ID) as GeoJSONSource | undefined;
  source?.setData(toRoutesGeoJson(routes, hoverProgress));
}

function getRouteDayPathId(event: { readonly features?: readonly unknown[] }): string | null {
  const feature = event.features?.[0];
  if (!feature || typeof feature !== "object" || !("properties" in feature)) {
    return null;
  }

  const properties = feature.properties;
  if (!properties || typeof properties !== "object" || !("dayPathId" in properties)) {
    return null;
  }

  return typeof properties.dayPathId === "string" ? properties.dayPathId : null;
}

function addRouteLayers(map: MapboxMap, hoveredMarkerRef: HoveredMarkerRef): void {
  map.addSource(ROUTE_SOURCE_ID, {
    type: "geojson",
    data: toRoutesGeoJson([], new Map()),
  });
  map.addLayer({
    id: ROUTE_BORDER_LAYER_ID,
    type: "line",
    source: ROUTE_SOURCE_ID,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": "#FFFFFF",
      "line-width": [
        "interpolate",
        ["linear"],
        ["to-number", ["get", "hoverProgress"], 0],
        0,
        8,
        1,
        10,
      ],
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
      "line-width": [
        "interpolate",
        ["linear"],
        ["to-number", ["get", "hoverProgress"], 0],
        0,
        4,
        1,
        6,
      ],
      "line-opacity": ["get", "opacity"],
    },
  });
  // mouseenter가 아니라 mousemove를 듣는다. 마커에서 다시 선 위로 빠져나올 때
  // 지도는 여전히 선 안에 있다고 보아 mouseenter를 다시 쏘지 않기 때문이다.
  map.on("mousemove", ROUTE_LAYER_ID, (event) => {
    map.getCanvas().style.cursor = "pointer";
    if (hoveredMarkerRef.current) {
      return;
    }

    const dayPathId = getRouteDayPathId(event);
    const state = usePlannerViewStore.getState();
    if (dayPathId && state.hoveredItemId !== dayPathId) {
      state.setHoveredItem(dayPathId);
    }
  });
  map.on("mouseleave", ROUTE_LAYER_ID, () => {
    map.getCanvas().style.cursor = "";
    const state = usePlannerViewStore.getState();
    const hoveredNode = state.hoveredItemId
      ? state.tree.entityMap.get(state.hoveredItemId)
      : undefined;
    if (hoveredNode?.kind === "day") {
      state.setHoveredItem(null);
    }
  });
  map.on("click", ROUTE_LAYER_ID, (event) => {
    const dayPathId = getRouteDayPathId(event);
    if (dayPathId) {
      usePlannerViewStore.getState().activateItem(dayPathId);
    }
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
  const hoveredItemId = usePlannerViewStore((state) => state.hoveredItemId);
  const mapFocusRequest = usePlannerViewStore((state) => state.mapFocusRequest);
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
  const lastHandledFocusRequestRef = useRef(mapFocusRequest);
  const renderedMarkersRef = useRef(new Map<string, RenderedMarker>());
  const hoveredMarkerRef = useRef<PlannerNodePathId | null>(null);
  const routeHoverProgressRef = useRef<PlannerRouteHoverProgress>(new Map());
  const mapModel = useMemo(
    () => buildPlannerMapModel({ tree, hiddenDayIds, selectedItemId, hoveredItemId }),
    [hiddenDayIds, hoveredItemId, selectedItemId, tree],
  );
  const mapModelRef = useRef(mapModel);
  const mapFocusRequestRef = useRef(mapFocusRequest);

  useEffect(() => {
    mapModelRef.current = mapModel;
    mapFocusRequestRef.current = mapFocusRequest;
  }, [mapFocusRequest, mapModel]);

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
      addRouteLayers(map, hoveredMarkerRef);
      syncRoutes(map, mapModelRef.current.routes, routeHoverProgressRef.current);
      syncMarkers({
        map,
        markers: mapModelRef.current.markers,
        renderedMarkers,
        hoveredMarkerRef,
      });
      hasAppliedInitialCameraRef.current = applyInitialCamera(map, mapModelRef.current);
      const focusRequest = mapFocusRequestRef.current;
      const focus = mapModelRef.current.focus;
      if (focusRequest && focus?.pathId === focusRequest.pathId) {
        focusMap(map, focus);
      }
      lastHandledFocusRequestRef.current = mapFocusRequestRef.current;
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
      lastHandledFocusRequestRef.current = null;
    };
  }, [resolvedAccessToken, retryCount]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoadedRef.current) {
      return;
    }

    syncMarkers({
      map,
      markers: mapModel.markers,
      renderedMarkers: renderedMarkersRef.current,
      hoveredMarkerRef,
    });

    if (!hasAppliedInitialCameraRef.current) {
      hasAppliedInitialCameraRef.current = applyInitialCamera(map, mapModel);
    }

    if (!mapFocusRequest || lastHandledFocusRequestRef.current === mapFocusRequest) {
      return;
    }

    if (mapModel.focus?.pathId === mapFocusRequest.pathId) {
      focusMap(map, mapModel.focus);
    }
    lastHandledFocusRequestRef.current = mapFocusRequest;
  }, [mapFocusRequest, mapModel]);

  // hover 굵기를 프레임마다 보간해 넣는다. 첫 반영은 동기로 처리해 색·표시 여부는 즉시 맞춘다.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoadedRef.current) {
      return;
    }

    const applyStep = (elapsedMs: number): boolean => {
      const { progress, isSettled } = stepPlannerRouteHoverProgress(
        routeHoverProgressRef.current,
        mapModel.routes,
        elapsedMs,
      );
      routeHoverProgressRef.current = progress;
      syncRoutes(map, mapModel.routes, progress);
      return isSettled;
    };

    if (applyStep(0)) {
      return;
    }

    let frame = 0;
    let previousTime: number | null = null;
    const step = (time: number) => {
      const elapsedMs = previousTime === null ? 0 : time - previousTime;
      previousTime = time;
      if (!applyStep(elapsedMs)) {
        frame = requestAnimationFrame(step);
      }
    };
    frame = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [mapLoadState, mapModel.routes]);

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
