import { PlannerNodeLabel } from "@/features/planner/components/planner-node-label";
import { usePlannerViewStore } from "@/features/planner/stores/planner-view-store";
import type { FlattenedPlannerNode } from "@/features/planner/types/planner-node";
import { getPlannerRowIndentation } from "@/features/planner/utils/get-planner-row-indentation";

// DragOverlay 안에서 커서를 따라다니는 행 미리보기다.
// 잡는 단위가 라벨부터 시작하므로 오버레이 기준점도 그대로 라벨 상단이 된다.
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
        style={{ paddingLeft: getPlannerRowIndentation(node.depth) }}
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
