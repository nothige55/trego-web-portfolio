import type { Map as MapboxMap } from "mapbox-gl";

import type { PlannerMapFocus, PlannerMapModel } from "@/features/planner/map/planner-map-model";

// 지도 카메라 이동 규칙이다. 초기 진입은 전체 일정을 담고, 이후 focus 요청은 해당 대상만 확대한다.
export const DEFAULT_CENTER: [longitude: number, latitude: number] = [126.5312, 33.4996];
export const DEFAULT_ZOOM = 9;
const SINGLE_MARKER_ZOOM = 13;
const FOCUSED_MARKER_ZOOM = 14;
const CAMERA_ANIMATION_DURATION = 500;
const FOCUS_PADDING = 80;

export function applyInitialCamera(map: MapboxMap, model: PlannerMapModel): boolean {
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

export function focusMap(map: MapboxMap, focus: PlannerMapFocus): void {
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
