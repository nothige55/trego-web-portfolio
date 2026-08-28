import { useMemo } from "react";

import type { AiPlannerContextItem } from "@/features/ai-planner/types/ai-planner";
import { usePlannerViewStore } from "@/features/planner/stores/planner-view-store";

// Planner의 선택 상태를 AI 문맥으로 옮기는 유일한 지점이다.
// planner와 ai-planner는 서로를 직접 import할 수 없으므로 두 feature를 아는 app 레이어가 소유한다.
export function useAiPlannerContext(): readonly AiPlannerContextItem[] {
  const nodes = usePlannerViewStore((state) => state.nodes);
  const selectedItemId = usePlannerViewStore((state) => state.selectedItemId);
  const multiSelectedIds = usePlannerViewStore((state) => state.multiSelectedIds);

  return useMemo(() => {
    const selectedPathIds =
      multiSelectedIds.length > 0
        ? new Set<string>(multiSelectedIds)
        : new Set<string>(selectedItemId ? [selectedItemId] : []);

    return nodes
      .filter((node) => selectedPathIds.has(node.pathId))
      .map((node) => ({
        kind: node.kind,
        name: node.name,
        pathId: node.pathId,
        parentPathId: node.parentPathId,
        position: node.position,
        ...(node.kind === "activity"
          ? { endTime: node.endTime, memo: node.memo, startTime: node.startTime }
          : {}),
      }));
  }, [multiSelectedIds, nodes, selectedItemId]);
}
