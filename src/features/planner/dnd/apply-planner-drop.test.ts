import { describe, expect, it } from "vitest";

import { applyPlannerDrop } from "@/features/planner/dnd/apply-planner-drop";
import type {
  PlannerActivityNode,
  PlannerDayNode,
  PlannerFolderNode,
  PlannerNode,
} from "@/features/planner/types/planner-node";
import { buildPlannerTree } from "@/features/planner/utils/build-planner-tree";

function folder(pathId: string, parentPathId: string | null, position: number): PlannerFolderNode {
  return {
    kind: "folder",
    id: `folder-${pathId}`,
    name: pathId,
    pathId,
    parentPathId,
    position,
    folderType: "default",
  };
}

function day(pathId: string, parentPathId: string, position: number): PlannerDayNode {
  return {
    kind: "day",
    id: `day-${pathId}`,
    name: pathId,
    pathId,
    parentPathId,
    position,
    color: null,
  };
}

function activity(pathId: string, parentPathId: string, position: number): PlannerActivityNode {
  return {
    kind: "activity",
    id: `activity-${pathId}`,
    name: pathId,
    pathId,
    parentPathId,
    position,
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
  };
}

describe("applyPlannerDrop", () => {
  it("reparents a subtree and rebuilds depth and sibling indexes without mutating input", () => {
    const nodes: readonly PlannerNode[] = Object.freeze([
      Object.freeze(folder("root", null, 0)),
      Object.freeze(folder("region", "root", 0.1)),
      Object.freeze(day("day-one", "region", 0.1)),
      Object.freeze(activity("place", "day-one", 0.1)),
      Object.freeze(day("day-two", "region", 0.2)),
    ]);
    const tree = buildPlannerTree(nodes);
    const originalSnapshot = structuredClone(tree.flattenedItems);

    const result = applyPlannerDrop(tree, "day-one", {
      parentPathId: "root",
      siblingIndex: 1,
      position: 0.2,
    });

    expect(tree.flattenedItems).toEqual(originalSnapshot);
    expect(result.entityMap.get("day-one")).toMatchObject({
      parentPathId: "root",
      depth: 1,
      siblingIndex: 1,
      position: 0.2,
    });
    expect(result.entityMap.get("place")).toMatchObject({
      parentPathId: "day-one",
      depth: 2,
    });
    expect(result.childrenMap.get("region")?.map((node) => node.pathId)).toEqual(["day-two"]);
  });

  it("returns the original tree when the active node does not exist", () => {
    const tree = buildPlannerTree([folder("root", null, 0), day("day", "root", 0.1)]);

    expect(
      applyPlannerDrop(tree, "missing", {
        parentPathId: "root",
        siblingIndex: 0,
        position: 0.1,
      }),
    ).toBe(tree);
  });
});
