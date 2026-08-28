import { useCallback } from "react";

import type {
  AiPlannerOperationExecutor,
  AiPlannerProposedOperation,
} from "@/features/ai-planner/types/ai-planner";
import type { PlannerOperationCommand } from "@/features/planner/operations/planner-operation-command";
import { usePlannerViewStore } from "@/features/planner/stores/planner-view-store";
import type { PlannerRecordedOperationRunner } from "@/features/planner/types/planner-editing-commands";
import type { PlannerActivityNode } from "@/features/planner/types/planner-node";

function findActivity(pathId: string): PlannerActivityNode {
  const node = usePlannerViewStore
    .getState()
    .nodes.find((candidate) => candidate.pathId === pathId);
  if (!node || node.kind !== "activity") {
    throw new Error("변경 대상 Activity를 찾을 수 없습니다. 일정을 다시 불러와 주세요.");
  }
  return node;
}

// 수동 편집과 같은 규약으로 되돌린다: undo는 Activity 전체 스냅샷을 보낸다.
function createActivitySnapshot(node: PlannerActivityNode) {
  return {
    id: node.id,
    name: node.name,
    memo: node.memo,
    startTime: node.startTime,
    endTime: node.endTime,
    markerType: node.markerType,
    travelMode: node.travelMode,
    travelTime: node.travelTime,
    travelDistance: node.travelDistance,
    travelCost: node.travelCost,
  };
}

function createOperationCommands(operation: AiPlannerProposedOperation): {
  readonly redo: PlannerOperationCommand;
  readonly undo: PlannerOperationCommand;
} {
  const node = findActivity(operation.pathId);

  if (operation.type === "move-activity") {
    const destination = usePlannerViewStore
      .getState()
      .nodes.find((candidate) => candidate.pathId === operation.destinationParentPathId);
    if (!destination || destination.kind === "activity") {
      throw new Error("이동할 위치를 찾을 수 없습니다.");
    }

    return {
      redo: {
        type: "update-path",
        input: {
          pathId: node.pathId,
          parentPathId: operation.destinationParentPathId,
          position: operation.position,
        },
      },
      undo: {
        type: "update-path",
        input: {
          pathId: node.pathId,
          parentPathId: node.parentPathId,
          position: node.position,
        },
      },
    };
  }

  const snapshot = createActivitySnapshot(node);
  const changes =
    operation.type === "update-activity-memo"
      ? { memo: operation.memo }
      : { startTime: operation.startTime, endTime: operation.endTime };

  return {
    redo: { type: "update-activity", input: { ...snapshot, ...changes } },
    undo: { type: "update-activity", input: snapshot },
  };
}

// 승인 단위가 곧 실행 단위다. 여러 변경도 히스토리에는 한 항목으로 남아 undo 한 번에 되돌아간다.
export function buildAiPlannerCommands(operations: readonly AiPlannerProposedOperation[]): {
  readonly redo: readonly PlannerOperationCommand[];
  readonly undo: readonly PlannerOperationCommand[];
} {
  const commands = operations.map(createOperationCommands);

  return {
    redo: commands.map((command) => command.redo),
    undo: commands.map((command) => command.undo).reverse(),
  };
}

// AI가 승인받은 변경을 수동 편집과 동일한 Planner 명령으로 실행한다.
// 덕분에 optimistic 반영, 서버 검증, SignalR 전파, undo가 모두 그대로 재사용된다.
export function useAiPlannerExecution(
  runRecordedOperation: PlannerRecordedOperationRunner,
): AiPlannerOperationExecutor {
  return useCallback(
    async (operations) => {
      if (operations.length === 0) return;

      const { redo, undo } = buildAiPlannerCommands(operations);
      await runRecordedOperation("AI 변경 적용", redo, undo);
    },
    [runRecordedOperation],
  );
}
