import { PlannerNodeLabel } from "@/features/planner/components/planner-node-label";
import { usePlannerViewStore } from "@/features/planner/stores/planner-view-store";
import type { FlattenedPlannerNode } from "@/features/planner/types/planner-node";

// DragOverlay 안에서 커서를 따라다니는 행 미리보기다.
// 목록 행과 달리 선택·드롭 상태를 표현하지 않으므로 강조는 항상 같은 모양이다.
export function PlannerDragPreview({
  node,
  dayNumber,
}: {
  readonly node: FlattenedPlannerNode;
  readonly dayNumber?: number;
}) {
  const entityMap = usePlannerViewStore((state) => state.tree.entityMap);

  return (
    <div className="pointer-events-none w-80 bg-card">
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
