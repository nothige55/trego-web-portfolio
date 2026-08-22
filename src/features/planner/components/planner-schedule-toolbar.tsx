import { ListChevronsDownUp, Redo2, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PlannerNodeCreateDialog } from "@/features/planner/components/planner-node-create-dialog";
import { usePlannerHistoryStore } from "@/features/planner/stores/planner-history-store";
import { usePlannerViewStore } from "@/features/planner/stores/planner-view-store";
import type { PlannerNodeEditingCommands } from "@/features/planner/types/planner-editing-commands";

// 목록 위에 고정되는 조작 줄이다.
// 각 버튼은 대응하는 command가 주입된 경우에만 노출해 읽기 전용 세션에서 빈 동작을 만들지 않는다.
export function PlannerScheduleToolbar({
  commands,
}: {
  readonly commands?: PlannerNodeEditingCommands;
}) {
  const tree = usePlannerViewStore((state) => state.tree);
  const rootPathId = usePlannerViewStore((state) => state.rootPathId);
  const expandedIds = usePlannerViewStore((state) => state.expandedIds);
  const collapseAll = usePlannerViewStore((state) => state.collapseAll);
  const historyPastCount = usePlannerHistoryStore((state) => state.past.length);
  const historyFutureCount = usePlannerHistoryStore((state) => state.future.length);
  const isHistoryReplaying = usePlannerHistoryStore((state) => state.isReplaying);
  const rootChildren = rootPathId ? (tree.childrenMap.get(rootPathId) ?? []) : [];
  // 접힌 부모 아래의 펼침 상태는 복원용으로 보존하되 버튼 노출에는 사용하지 않는다.
  const hasExpandedTopLevelBranch = rootChildren.some(
    (node) => expandedIds.has(node.pathId) && (tree.childrenMap.get(node.pathId)?.length ?? 0) > 0,
  );

  return (
    <div className="absolute inset-x-0 top-0 z-50 flex h-8 items-center justify-between bg-card px-6 pr-2 text-sm font-medium">
      <span>일정</span>
      <div className="flex items-center gap-0.5">
        {commands?.undo ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="실행 취소"
            disabled={historyPastCount === 0 || isHistoryReplaying}
            onClick={() => void commands.undo?.().catch(() => undefined)}
          >
            <Undo2 aria-hidden="true" />
          </Button>
        ) : null}
        {commands?.redo ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="다시 실행"
            disabled={historyFutureCount === 0 || isHistoryReplaying}
            onClick={() => void commands.redo?.().catch(() => undefined)}
          >
            <Redo2 aria-hidden="true" />
          </Button>
        ) : null}
        {commands?.createNode && commands.extendDateRange && rootPathId ? (
          <PlannerNodeCreateDialog
            rootPathId={rootPathId}
            onCreate={commands.createNode}
            onExtendDateRange={commands.extendDateRange}
          />
        ) : null}
        {hasExpandedTopLevelBranch ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6"
            aria-label="모든 일정 접기"
            onClick={collapseAll}
          >
            <ListChevronsDownUp aria-hidden="true" className="size-3.5" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
