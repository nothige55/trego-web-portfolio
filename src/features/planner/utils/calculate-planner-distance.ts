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

// 좌표가 없으면 거리를 낼 수 없어 경로 정보를 아예 그리지 않는다.
// 행과 드래그 미리보기가 같은 판정을 써야 미리보기 시작 위치가 어긋나지 않는다.
export function hasPlannerRouteInfo(
  activity: PlannerActivityNode,
  previousActivity: PlannerActivityNode,
): boolean {
  return calculatePlannerDistanceKm(previousActivity, activity) !== null;
}
