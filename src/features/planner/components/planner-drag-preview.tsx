import { PlannerNodeLabel } from "@/features/planner/components/planner-node-label";
import { PLANNER_ROUTE_INFO_HEIGHT } from "@/features/planner/components/planner-route-info";
import { usePlannerViewStore } from "@/features/planner/stores/planner-view-store";
import type {
  FlattenedPlannerNode,
  PlannerActivityNode,
} from "@/features/planner/types/planner-node";
import { hasPlannerRouteInfo } from "@/features/planner/utils/calculate-planner-distance";

// DragOverlay 안에서 커서를 따라다니는 행 미리보기다.
// 목록 행과 달리 선택·드롭 상태를 표현하지 않으므로 강조는 항상 같은 모양이다.
export function PlannerDragPreview({
  node,
  dayNumber,
  previousActivity,
}: {
  readonly node: FlattenedPlannerNode;
  readonly dayNumber?: number;
  readonly previousActivity?: PlannerActivityNode;
}) {
  const entityMap = usePlannerViewStore((state) => state.tree.entityMap);
  // DragOverlay는 잡은 요소의 전체 높이에 맞춰 위치를 잡는데, 경로 정보는 그 요소 안에서
  // 행보다 위에 있다. 그만큼 내려 주지 않으면 미리보기가 경로 정보 자리에서 시작한다.
  const hasRouteInfo =
    node.kind === "activity" &&
    previousActivity !== undefined &&
    hasPlannerRouteInfo(node, previousActivity);

  return (
    <div
      className="pointer-events-none w-80 bg-card"
      style={hasRouteInfo ? { transform: `translateY(${PLANNER_ROUTE_INFO_HEIGHT}px)` } : undefined}
    >
      <div
        className="flex min-h-9 items-center border-l-2 border-brand bg-brand/10 text-foreground"
        style={{ paddingLeft: Math.max(0, node.depth - 1) * 30 }}
      >
        <span className="h-9 w-5 shrink-0" aria-hidden="true" />
        <PlannerNodeLabel
          node={node}
          dayNumber={dayNumber}
          parent={node.parentPathId ? entityMap.get(node.parentPathId) : undefined}
          className="flex-1 py-2.5 pr-2"
        />
      </div>
    </div>
  );
}
