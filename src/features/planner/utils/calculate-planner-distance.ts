// 두 장소 좌표 사이의 직선(하버사인) 거리와 그 표기를 계산
// 좌표가 없으면 null을 돌려주며, 행 장식은 이 값으로 경로 정보를 그릴지 정함

import type { PlannerActivityNode } from "@/features/planner/types/planner-node";

const EARTH_RADIUS_KM = 6371;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function calculatePlannerDistanceKm(
  from: PlannerActivityNode,
  to: PlannerActivityNode,
): number | null {
  if (
    from.latitude === null ||
    from.longitude === null ||
    to.latitude === null ||
    to.longitude === null ||
    !Number.isFinite(from.latitude) ||
    !Number.isFinite(from.longitude) ||
    !Number.isFinite(to.latitude) ||
    !Number.isFinite(to.longitude)
  ) {
    return null;
  }

  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(haversine));
}

export function formatPlannerDistance(distanceKm: number): string {
  return distanceKm < 1
    ? `${Math.max(1, Math.round(distanceKm * 1000))}m`
    : `${distanceKm < 10 ? distanceKm.toFixed(1) : Math.round(distanceKm)}km`;
}
