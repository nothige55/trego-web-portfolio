import { PlannerNodeLabel } from "@/features/planner/components/planner-node-label";
import { usePlannerViewStore } from "@/features/planner/stores/planner-view-store";
import type { FlattenedPlannerNode } from "@/features/planner/types/planner-node";
import { getPlannerRowIndentation } from "@/features/planner/utils/get-planner-row-indentation";

// DragOverlay 안에서 커서를 따라다니는 행 미리보기다.
// 잡는 단위가 라벨부터 시작하므로 오버레이 기준점도 그대로 라벨 상단이 된다.
//
// 목록 폭을 그대로 채우면 커서 아래 행을 통째로 덮어, 그 행이 사라진 것처럼 보인다.
// 내용만큼만 차지하고 그림자로 떠 있음을 알려 아래 행이 계속 읽히게 한다.
export function PlannerDragPreview({
  node,
  dayNumber,
}: {
  readonly node: FlattenedPlannerNode;
  readonly dayNumber?: number;
}) {
  const entityMap = usePlannerViewStore((state) => state.tree.entityMap);
  const indentation = getPlannerRowIndentation(node.depth);

  return (
    <div className="pointer-events-none w-fit max-w-80" style={{ paddingLeft: indentation }}>
      <div className="flex min-h-9 w-fit items-center rounded-md border-l-2 border-brand bg-card pr-3 text-foreground shadow-lg ring-1 ring-brand/30">
        <span className="h-9 w-5 shrink-0" aria-hidden="true" />
        <PlannerNodeLabel
          node={node}
          dayNumber={dayNumber}
          parent={node.parentPathId ? entityMap.get(node.parentPathId) : undefined}
          className="py-2.5"
        />
      </div>
    </div>
  );
}
