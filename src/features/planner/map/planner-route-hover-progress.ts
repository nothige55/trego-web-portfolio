import type { PlannerMapRoute } from "@/features/planner/map/planner-map-model";
import type { PlannerNodePathId } from "@/features/planner/types/planner-node";

// 지도 paint transition은 setData로 갈아 끼운 feature 속성에는 적용되지 않는다.
// 경로선 hover 굵기가 눈에 보이게 변하도록 진행도를 직접 보간한다.
// 마커(200ms)보다는 빠르되 즉시 바뀌었다고 느껴지지 않을 만큼만 준다.
export const ROUTE_HOVER_TRANSITION_MS = 120;

export type PlannerRouteHoverProgress = ReadonlyMap<PlannerNodePathId, number>;

export function stepPlannerRouteHoverProgress(
  current: PlannerRouteHoverProgress,
  routes: readonly PlannerMapRoute[],
  elapsedMs: number,
): { readonly progress: PlannerRouteHoverProgress; readonly isSettled: boolean } {
  const step = elapsedMs / ROUTE_HOVER_TRANSITION_MS;
  const progress = new Map<PlannerNodePathId, number>();
  let isSettled = true;

  routes.forEach((route) => {
    const target = route.isHovered ? 1 : 0;
    // 새로 나타난 경로는 애니메이션 없이 목표 상태에서 시작한다.
    const previous = current.get(route.dayPathId) ?? target;
    const next =
      previous < target ? Math.min(target, previous + step) : Math.max(target, previous - step);

    if (next !== target) {
      isSettled = false;
    }
    progress.set(route.dayPathId, next);
  });

  return { progress, isSettled };
}
