import { addDays, format, parseISO } from "date-fns";

import {
  buildPlannerDateRangeHistory,
  buildPlannerDeleteHistory,
  type PlannerDateRangeInput,
} from "@/features/planner/operations/planner-date-range";
import type { PlannerOperationCommand } from "@/features/planner/operations/planner-operation-command";
import {
  buildCreateNodeInput,
  buildGroupPlan,
  normalizeOperationPathIds,
} from "@/features/planner/operations/planner-operations";
import { usePlannerViewStore } from "@/features/planner/stores/planner-view-store";
import type {
  PlannerHistoryReplayer,
  PlannerNodeEditingCommands,
  PlannerRecordedOperationRunner,
} from "@/features/planner/types/planner-editing-commands";

const FALLBACK_DAY_COLOR = "#F44336";
const MISSING_DATE_RANGE_MESSAGE = "여행 날짜 정보를 불러오지 못했습니다.";

// UI가 호출하는 편집 동작을 redo/undo 커맨드 쌍으로 번역한다.
// 실행과 히스토리 적재는 주입받은 실행기가 맡으므로 여기에는 React도 통신도 없다.
export function createPlannerEditingCommands({
  replayHistory,
  runRecordedOperation,
}: {
  readonly replayHistory: PlannerHistoryReplayer;
  readonly runRecordedOperation: PlannerRecordedOperationRunner;
}): PlannerNodeEditingCommands {
  const updateDateRange = async (input: PlannerDateRangeInput): Promise<void> => {
    const state = usePlannerViewStore.getState();
    if (!state.projectDetails || !state.rootPathId) {
      throw new Error(MISSING_DATE_RANGE_MESSAGE);
    }

    const history = buildPlannerDateRangeHistory({
      input,
      nodes: state.nodes,
      orderedPathIds: state.tree.flattenedItems.map((node) => node.pathId),
      projectDetails: state.projectDetails,
      rootPathId: state.rootPathId,
    });
    await runRecordedOperation("여행 날짜 변경", history.redo, history.undo);
  };

  return {
    createNode: async (draft) => {
      const created = buildCreateNodeInput(usePlannerViewStore.getState().nodes, draft);
      const createOperation: PlannerOperationCommand = {
        type: created.kind === "day" ? "create-day" : "create-folder",
        input: created.input,
      } as PlannerOperationCommand;
      await runRecordedOperation(
        "일정 추가",
        [createOperation],
        [{ type: "delete-node", input: { pathId: created.input.pathId } }],
      );
    },
    deleteNode: async (input) => {
      const state = usePlannerViewStore.getState();
      if (!state.projectDetails) {
        throw new Error(MISSING_DATE_RANGE_MESSAGE);
      }
      const history = buildPlannerDeleteHistory({
        nodes: state.nodes,
        pathIds: [input.pathId],
        projectDetails: state.projectDetails,
      });
      await runRecordedOperation("일정 삭제", history.redo, history.undo);
    },
    deleteNodes: async (pathIds) => {
      const state = usePlannerViewStore.getState();
      if (!state.projectDetails) {
        throw new Error(MISSING_DATE_RANGE_MESSAGE);
      }
      const normalizedPathIds = normalizeOperationPathIds(state.nodes, pathIds);
      const history = buildPlannerDeleteHistory({
        nodes: state.nodes,
        pathIds: normalizedPathIds,
        projectDetails: state.projectDetails,
      });
      await runRecordedOperation("선택 일정 삭제", history.redo, history.undo);
    },
    extendDateRange: async () => {
      const projectDetails = usePlannerViewStore.getState().projectDetails;
      if (!projectDetails) {
        throw new Error(MISSING_DATE_RANGE_MESSAGE);
      }
      await updateDateRange({
        startDate: projectDetails.startDate.slice(0, 10),
        endDate: format(addDays(parseISO(projectDetails.endDate), 1), "yyyy-MM-dd"),
      });
    },
    groupNodes: async (pathIds) => {
      const nodes = usePlannerViewStore.getState().nodes;
      const plan = buildGroupPlan(nodes, pathIds);
      const containerOperation: PlannerOperationCommand = {
        type: plan.container.kind === "activity" ? "create-activity" : "create-folder",
        input: plan.container.input,
      } as PlannerOperationCommand;
      const originals = plan.moves.map((move) => {
        const node = nodes.find((candidate) => candidate.pathId === move.pathId)!;
        return {
          type: "update-path" as const,
          input: {
            pathId: node.pathId,
            parentPathId: node.parentPathId,
            position: node.position,
          },
        };
      });
      await runRecordedOperation(
        "선택 일정 그룹화",
        [
          containerOperation,
          ...plan.moves.map((input) => ({ type: "update-path" as const, input })),
        ],
        [...originals, { type: "delete-node", input: { pathId: plan.container.input.pathId } }],
      );
    },
    redo: () => replayHistory("redo"),
    undo: () => replayHistory("undo"),
    updateActivity: async (input) => {
      const node = usePlannerViewStore
        .getState()
        .nodes.find((candidate) => candidate.kind === "activity" && candidate.id === input.id);
      if (!node || node.kind !== "activity") {
        throw new Error("Activity를 찾을 수 없습니다.");
      }
      await runRecordedOperation(
        "Activity 메모 수정",
        [{ type: "update-activity", input }],
        [
          {
            type: "update-activity",
            input: {
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
            },
          },
        ],
      );
    },
    updateDay: async (input) => {
      const node = usePlannerViewStore
        .getState()
        .nodes.find((candidate) => candidate.kind === "day" && candidate.id === input.id);
      if (!node || node.kind !== "day") {
        throw new Error("Day를 찾을 수 없습니다.");
      }
      await runRecordedOperation(
        "Day 수정",
        [{ type: "update-day", input }],
        [
          {
            type: "update-day",
            input: { id: node.id, name: node.name, color: node.color ?? FALLBACK_DAY_COLOR },
          },
        ],
      );
    },
    updateFolder: async (input) => {
      const node = usePlannerViewStore
        .getState()
        .nodes.find((candidate) => candidate.kind === "folder" && candidate.id === input.id);
      if (!node || node.kind !== "folder") {
        throw new Error("폴더를 찾을 수 없습니다.");
      }
      await runRecordedOperation(
        "폴더 수정",
        [{ type: "update-folder", input }],
        [
          {
            type: "update-folder",
            input: {
              id: node.id,
              name: node.name,
              folderType: node.folderType ?? "default",
            },
          },
        ],
      );
    },
    updateDateRange,
  };
}
