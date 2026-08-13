import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildPlannerDateRangeHistory,
  buildPlannerDeleteHistory,
  getPlannerDateRangeChangeSummary,
} from "@/features/planner/operations/planner-date-range";
import type { PlannerNode } from "@/features/planner/types/planner-node";

const projectDetails = {
  publicId: "project",
  title: "제주 여행",
  startDate: "2026-08-12",
  endDate: "2026-08-13",
  isPublic: false,
};
const nodes: readonly PlannerNode[] = [
  {
    kind: "folder",
    id: "root-id",
    name: "제주 여행",
    folderType: "root",
    pathId: "root",
    parentPathId: null,
    position: 0,
  },
  ...["12", "13"].map(
    (suffix, index): PlannerNode => ({
      kind: "day",
      id: `day-${suffix}-id`,
      name: `8월 ${suffix}일`,
      color: "#fff",
      pathId: `day-${suffix}`,
      parentPathId: "root",
      position: (index + 1) * 0.1,
    }),
  ),
  {
    kind: "activity",
    id: "activity-id",
    name: "장소",
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
    pathId: "activity",
    parentPathId: "day-13",
    position: 0.1,
  },
];
const orderedPathIds = ["root", "day-12", "day-13", "activity"];

describe("planner date range operations", () => {
  beforeEach(() => {
    vi.spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValueOnce("11111111-1111-4111-8111-111111111111")
      .mockReturnValueOnce("22222222-2222-4222-8222-222222222222");
  });

  it("renames only automatic date names and creates missing trailing days", () => {
    const nodesWithCustomDayName = nodes.map((node) =>
      node.pathId === "day-13" ? { ...node, name: "제주 동부 여행" } : node,
    );
    const history = buildPlannerDateRangeHistory({
      input: { startDate: "2026-09-01", endDate: "2026-09-03" },
      nodes: nodesWithCustomDayName,
      orderedPathIds,
      projectDetails,
      rootPathId: "root",
    });

    expect(history.redo).toEqual([
      expect.objectContaining({ type: "update-project" }),
      expect.objectContaining({
        type: "update-day",
        input: expect.objectContaining({ name: "9월 1일" }),
      }),
      expect.objectContaining({
        type: "create-day",
        input: expect.objectContaining({ name: "9월 3일", parentPathId: "root" }),
      }),
    ]);
    expect(history.redo[2]?.input).toEqual(
      expect.objectContaining({ position: expect.closeTo(0.3) }),
    );
    expect(history.undo).toContainEqual({
      type: "delete-node",
      input: { pathId: "22222222-2222-4222-8222-222222222222" },
    });
  });

  it("reports affected activities and restores a shortened day subtree on undo", () => {
    const input = { startDate: "2026-08-12", endDate: "2026-08-12" };

    expect(getPlannerDateRangeChangeSummary(nodes, orderedPathIds, input)).toEqual({
      removedActivityCount: 1,
      removedDayCount: 1,
      targetDayCount: 1,
    });
    const history = buildPlannerDateRangeHistory({
      input,
      nodes,
      orderedPathIds,
      projectDetails,
      rootPathId: "root",
    });
    expect(history.redo).toContainEqual({ type: "delete-node", input: { pathId: "day-13" } });
    expect(history.undo.map((operation) => operation.type)).toEqual([
      "update-project",
      "create-day",
      "create-activity",
    ]);
  });

  it("shortens the project range when deleting a Day and restores it on undo", () => {
    const history = buildPlannerDeleteHistory({
      nodes,
      pathIds: ["day-13"],
      projectDetails,
    });

    expect(history.redo).toEqual([
      { type: "delete-node", input: { pathId: "day-13" } },
      {
        type: "update-project",
        input: expect.objectContaining({ startDate: "2026-08-12", endDate: "2026-08-12" }),
      },
    ]);
    expect(history.undo.map((operation) => operation.type)).toEqual([
      "create-day",
      "create-activity",
      "update-project",
    ]);
    expect(history.undo.at(-1)).toEqual({ type: "update-project", input: projectDetails });
  });

  it("does not change the project range when deleting a non-Day node", () => {
    const history = buildPlannerDeleteHistory({
      nodes,
      pathIds: ["activity"],
      projectDetails,
    });

    expect(history.redo).toEqual([{ type: "delete-node", input: { pathId: "activity" } }]);
    expect(history.undo.map((operation) => operation.type)).toEqual(["create-activity"]);
  });
});
