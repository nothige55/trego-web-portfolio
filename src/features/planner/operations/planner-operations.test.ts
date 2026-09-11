import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildDeleteHistoryOperations } from "@/features/planner/operations/planner-operation-command";
import {
  buildCreateNodeInput,
  buildGroupPlan,
  buildPlaceActivityInput,
  getAppendPosition,
  normalizeOperationPathIds,
} from "@/features/planner/operations/planner-operations";
import type { PlannerNode } from "@/features/planner/types/planner-node";

const nodes: readonly PlannerNode[] = [
  {
    kind: "folder",
    id: "root-id",
    name: "Root",
    folderType: "root",
    pathId: "root",
    parentPathId: null,
    position: 0,
  },
  {
    kind: "day",
    id: "day-id",
    name: "Day",
    color: "#fff",
    pathId: "day",
    parentPathId: "root",
    position: 0.1,
  },
  ...["one", "two"].map(
    (pathId, index): PlannerNode => ({
      kind: "activity",
      id: `${pathId}-id`,
      name: pathId,
      activityType: "single",
      memo: null,
      markerType: null,
      travelMode: null,
      travelTime: null,
      travelDistance: null,
      travelCost: null,
      startTime: null,
      endTime: null,
      placeId: null,
      latitude: null,
      longitude: null,
      googlePlaceId: null,
      pathId,
      parentPathId: "day",
      position: (index + 1) * 0.1,
    }),
  ),
];

describe("planner operations", () => {
  beforeEach(() => {
    vi.spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValueOnce("11111111-1111-4111-8111-111111111111")
      .mockReturnValueOnce("22222222-2222-4222-8222-222222222222");
  });

  it("appends new nodes with the legacy fractional position step", () => {
    expect(getAppendPosition(nodes, "day")).toBeCloseTo(0.3);
    const result = buildCreateNodeInput(nodes, {
      kind: "day",
      name: " New day ",
      parentPathId: "root",
    });

    expect(result).toMatchObject({
      kind: "day",
      input: {
        id: "11111111-1111-4111-8111-111111111111",
        pathId: "22222222-2222-4222-8222-222222222222",
        name: "New day",
        parentPathId: "root",
      },
    });
    expect(result.input.position).toBeCloseTo(0.2);
  });

  it("appends a searched place with its coordinates as the last activity of a day", () => {
    const input = buildPlaceActivityInput(nodes, {
      parentPathId: "day",
      name: "성산일출봉",
      latitude: 33.4581,
      longitude: 126.9425,
      rating: 4.7,
      ratingCount: 18432,
      googlePlaceId: "",
    });

    expect(input).toMatchObject({
      id: "11111111-1111-4111-8111-111111111111",
      pathId: "22222222-2222-4222-8222-222222222222",
      name: "성산일출봉",
      parentPathId: "day",
      activityType: "single",
      latitude: 33.4581,
      longitude: 126.9425,
      rating: 4.7,
      ratingCount: 18432,
    });
    expect(input.position).toBeCloseTo(0.3);
  });

  it("rejects adding a place under a node that cannot hold activities", () => {
    expect(() =>
      buildPlaceActivityInput(nodes, {
        parentPathId: "root",
        name: "성산일출봉",
        latitude: 33.4581,
        longitude: 126.9425,
        rating: 0,
        ratingCount: 0,
        googlePlaceId: "",
      }),
    ).toThrow("장소를 넣을 날짜를 찾을 수 없습니다.");
  });

  it("promotes selected ancestors so descendants are not operated twice", () => {
    expect(normalizeOperationPathIds(nodes, ["day", "one", "two"])).toEqual(["day"]);
  });

  it("groups sibling activities into a group activity and preserves order", () => {
    const plan = buildGroupPlan(nodes, ["two", "one"]);

    expect(plan.container).toMatchObject({
      kind: "activity",
      input: { activityType: "group", parentPathId: "day", position: 0.1 },
    });
    expect(plan.moves).toEqual([
      expect.objectContaining({ pathId: "one", position: 0.1 }),
      expect.objectContaining({ pathId: "two", position: 0.2 }),
    ]);
  });

  it("rejects grouping nodes from different parents", () => {
    expect(() =>
      buildGroupPlan(
        [...nodes, { ...nodes[3]!, pathId: "other", id: "other-id", parentPathId: "root" }],
        ["one", "other"],
      ),
    ).toThrow("같은 상위 일정");
  });

  it("restores a deleted subtree parent-first and deletes only its selected root", () => {
    const history = buildDeleteHistoryOperations(nodes, ["day"]);

    expect(history.redo).toEqual([{ type: "delete-node", input: { pathId: "day" } }]);
    expect(history.undo.map((operation) => operation.type)).toEqual([
      "create-day",
      "create-activity",
      "create-activity",
    ]);
  });
});
