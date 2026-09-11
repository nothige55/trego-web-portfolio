// 실시간 명령 실행과 undo/redo 히스토리를 잇는 지점
// 실패하면 부분 재생 상태를 남기지 않도록 히스토리를 통째로 비움

import { useCallback } from "react";

import {
  executePlannerOperationCommands,
  type PlannerOperationCommand,
} from "@/features/planner/operations/planner-operation-command";
import type { PlannerRealtimeCommands } from "@/features/planner/realtime/planner-realtime";
import type { UpdatePathInput } from "@/features/planner/realtime/project-hub-planner-contracts";
import { usePlannerHistoryStore } from "@/features/planner/stores/planner-history-store";
import type {
  PlannerHistoryReplayer,
  PlannerRecordedOperationRunner,
} from "@/features/planner/types/planner-editing-commands";

export type PlannerCommandInvoker = (
  invoke: (commands: PlannerRealtimeCommands) => Promise<void>,
) => Promise<void>;

export type PlannerRecordedOperations = {
  readonly replayHistory: PlannerHistoryReplayer;
  readonly runRecordedOperation: PlannerRecordedOperationRunner;
  readonly updatePath: (input: UpdatePathInput, previousInput: UpdatePathInput) => Promise<void>;
};

export function usePlannerRecordedOperations(
  invokePlannerCommand: PlannerCommandInvoker,
): PlannerRecordedOperations {
  const runRecordedOperation = useCallback<PlannerRecordedOperationRunner>(
    async (label, redo, undo) => {
      try {
        await invokePlannerCommand((commands) => executePlannerOperationCommands(commands, redo));
        usePlannerHistoryStore.getState().push({ label, redo, undo });
      } catch (error) {
        usePlannerHistoryStore.getState().clear();
        throw error;
      }
    },
    [invokePlannerCommand],
  );

  const replayHistory = useCallback<PlannerHistoryReplayer>(
    async (direction) => {
      const history = usePlannerHistoryStore.getState();
      const entry = direction === "undo" ? history.takeUndo() : history.takeRedo();
      if (!entry) {
        return;
      }

      try {
        await invokePlannerCommand((commands) =>
          executePlannerOperationCommands(commands, entry[direction]),
        );
        usePlannerHistoryStore.getState().finishReplay();
      } catch (error) {
        usePlannerHistoryStore.getState().clear();
        throw error;
      }
    },
    [invokePlannerCommand],
  );

  const updatePath = useCallback(
    (input: UpdatePathInput, previousInput: UpdatePathInput): Promise<void> =>
      runRecordedOperation(
        "일정 이동",
        [{ type: "update-path", input } satisfies PlannerOperationCommand],
        [{ type: "update-path", input: previousInput } satisfies PlannerOperationCommand],
      ),
    [runRecordedOperation],
  );

  return { replayHistory, runRecordedOperation, updatePath };
}
