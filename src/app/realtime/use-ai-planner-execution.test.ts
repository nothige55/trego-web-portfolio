import { afterEach, describe, expect, it } from "vitest";

import { buildAiPlannerCommands } from "@/app/realtime/use-ai-planner-execution";
import { usePlannerViewStore } from "@/features/planner/stores/planner-view-store";
import type {
  PlannerActivityNode,
  PlannerDayNode,
  PlannerNode,
} from "@/features/planner/types/planner-node";

function day(pathId: string, position: number): PlannerDayNode {
  return {
    kind: "day",
    id: `day-${pathId}`,
    name: pathId,
    pathId,
    parentPathId: null,
    position,
    color: null,
  };
}

function activity(pathId: string, parentPathId: string, position: number): PlannerActivityNode {
  return {
    kind: "activity",
    id: `entity-${pathId}`,
    name: pathId,
    pathId,
    parentPathId,
    position,
    activityType: "single",
    memo: "원래 메모",
    markerType: null,
    travelMode: null,
    travelTime: null,
    travelDistance: null,
    travelCost: null,
    startTime: "09:00",
    endTime: "10:00",
    placeId: null,
    latitude: null,
    longitude: null,
    googlePlaceId: null,
  };
}

function loadNodes(nodes: readonly PlannerNode[]) {
  usePlannerViewStore.getState().load(nodes);
}

describe("buildAiPlannerCommands", () => {
  afterEach(() => {
    usePlannerViewStore.getState().load([]);
  });

  it("turns a memo proposal into the same command pair a manual edit would produce", () => {
    loadNodes([day("day-1", 0), activity("activity-1", "day-1", 0)]);

    const { redo, undo } = buildAiPlannerCommands([
      {
        type: "update-activity-memo",
        pathId: "activity-1",
        memo: "새 메모",
        reason: "요청 반영",
      },
    ]);

    expect(redo).toEqual([
      {
        type: "update-activity",
        input: expect.objectContaining({ id: "entity-activity-1", memo: "새 메모" }),
      },
    ]);
    // undo는 변경 전 Activity 전체 스냅샷이라 다른 필드가 유실되지 않는다.
    expect(undo).toEqual([
      {
        type: "update-activity",
        input: expect.objectContaining({
          id: "entity-activity-1",
          memo: "원래 메모",
          startTime: "09:00",
          endTime: "10:00",
        }),
      },
    ]);
  });

  it("turns a move proposal into an update-path pair anchored on the current position", () => {
    loadNodes([day("day-1", 0), day("day-2", 1), activity("activity-1", "day-1", 0.5)]);

    const { redo, undo } = buildAiPlannerCommands([
      {
        type: "move-activity",
        pathId: "activity-1",
        destinationParentPathId: "day-2",
        position: 1.5,
        reason: "이동",
      },
    ]);

    expect(redo).toEqual([
      {
        type: "update-path",
        input: { pathId: "activity-1", parentPathId: "day-2", position: 1.5 },
      },
    ]);
    expect(undo).toEqual([
      {
        type: "update-path",
        input: { pathId: "activity-1", parentPathId: "day-1", position: 0.5 },
      },
    ]);
  });

  it("reverses the undo order so a multi-operation approval rewinds as one step", () => {
    loadNodes([day("day-1", 0), activity("activity-1", "day-1", 0)]);

    const { redo, undo } = buildAiPlannerCommands([
      { type: "update-activity-memo", pathId: "activity-1", memo: "메모", reason: "1" },
      {
        type: "update-activity-time",
        pathId: "activity-1",
        startTime: "14:00",
        endTime: "15:00",
        reason: "2",
      },
    ]);

    expect(redo).toHaveLength(2);
    expect(redo[1]).toEqual({
      type: "update-activity",
      input: expect.objectContaining({ startTime: "14:00", endTime: "15:00" }),
    });
    expect(undo).toHaveLength(2);
    expect(undo[0]).toEqual({
      type: "update-activity",
      input: expect.objectContaining({ startTime: "09:00", endTime: "10:00" }),
    });
  });

  it("refuses an operation that points outside the current Planner state", () => {
    loadNodes([day("day-1", 0)]);

    expect(() =>
      buildAiPlannerCommands([
        { type: "update-activity-memo", pathId: "activity-missing", memo: "메모", reason: "1" },
      ]),
    ).toThrow("변경 대상 Activity를 찾을 수 없습니다");
  });
});
