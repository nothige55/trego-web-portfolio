// mapbox-gl 인스턴스의 명령형 생명주기를 한곳에 모음
// 생성·로드 판정·모델 반영·hover 보간이 같은 ref 묶음을 공유하므로 더 쪼개지 않음

import mapboxgl, { type Map as MapboxMap } from "mapbox-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { buildPlannerMapModel } from "@/features/planner/map/build-planner-map-model";
import {
  applyInitialCamera,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  focusMap,
} from "@/features/planner/map/planner-map-camera";
import { type RenderedMarker, syncMarkers } from "@/features/planner/map/planner-map-markers";
import { addRouteLayers, syncRoutes } from "@/features/planner/map/planner-map-routes";
import {
  type PlannerRouteHoverProgress,
  stepPlannerRouteHoverProgress,
} from "@/features/planner/map/planner-route-hover-progress";
import { usePlannerMapStore } from "@/features/planner/stores/planner-map-store";
import { usePlannerViewStore } from "@/features/planner/stores/planner-view-store";
import type { PlannerNodePathId } from "@/features/planner/types/planner-node";

const MAP_STYLE = "mapbox://styles/mapbox/standard";
const MAP_LOAD_TIMEOUT_MS = 10_000;

export type PlannerMapLoadState = "loading" | "ready" | "error";

export type PlannerMapInstance = {
  readonly mapContainerRef: React.RefObject<HTMLDivElement | null>;
  readonly mapLoadState: PlannerMapLoadState;
  readonly resetCamera: () => void;
  readonly retry: () => void;
};

export function usePlannerMapInstance(accessToken: string | null | undefined): PlannerMapInstance {
  const tree = usePlannerViewStore((state) => state.tree);
  const selectedItemId = usePlannerViewStore((state) => state.selectedItemId);
  const hoveredItemId = usePlannerViewStore((state) => state.hoveredItemId);
  const mapFocusRequest = usePlannerViewStore((state) => state.mapFocusRequest);
  const hiddenDayIds = usePlannerMapStore((state) => state.hiddenDayIds);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const [mapLoadState, setMapLoadState] = useState<PlannerMapLoadState>("loading");
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
    if (!container || !accessToken) {
      return;
    }

    setMapLoadState("loading");
    let map: MapboxMap;
    try {
      map = new mapboxgl.Map({
        accessToken,
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
  }, [accessToken, retryCount]);

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

  // hover 굵기를 프레임마다 보간해 넣음. 첫 반영은 동기로 처리해 색·표시 여부는 즉시 맞춤
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

  const resetCamera = useCallback((): void => {
    const map = mapRef.current;
    if (map && isLoadedRef.current) {
      applyInitialCamera(map, mapModelRef.current);
    }
  }, []);

  const retry = useCallback((): void => {
    setMapLoadState("loading");
    setRetryCount((count) => count + 1);
  }, []);

  return { mapContainerRef, mapLoadState, resetCamera, retry };
}
