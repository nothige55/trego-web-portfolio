import { describe, expect, it } from "vitest";

import {
  removeActiveDescendants,
  resolvePlannerDrop,
} from "@/features/planner/dnd/resolve-planner-drop";
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
    id: pathId,
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
    id: pathId,
    name: pathId,
    pathId,
    parentPathId,
    position,
    color: null,
  };
}

function activity(
  pathId: string,
  parentPathId: string,
  position: number,
  activityType: string | null = "single",
): PlannerActivityNode {
  return {
    kind: "activity",
    id: pathId,
    name: pathId,
    pathId,
    parentPathId,
    position,
    activityType,
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

function createTree() {
  const nodes: readonly PlannerNode[] = [
    folder("root", null, 0),
    folder("region", "root", 0.1),
    day("day-one", "region", 0.1),
    activity("first", "day-one", 0.1),
    activity("active", "day-one", 0.2),
    activity("last", "day-one", 0.3),
    day("day-two", "region", 0.2),
    activity("group", "day-two", 0.1, "group"),
  ];
  return buildPlannerTree(nodes);
}

describe("resolvePlannerDrop", () => {
  it("calculates a same-parent trailing destination from the projected visible order", () => {
    const tree = createTree();

    expect(
      resolvePlannerDrop({
        tree,
        rootPathId: "root",
        visibleItems: tree.flattenedItems.filter((item) => item.pathId !== "root"),
        activePathId: "active",
        overPathId: "last",
        horizontalOffset: 0,
      }),
    ).toEqual({
      accepted: true,
      destination: { parentPathId: "day-one", siblingIndex: 2, position: 0.4 },
    });
  });

  it("uses a positive horizontal offset to nest a single activity under a group activity", () => {
    const tree = createTree();

    expect(
      resolvePlannerDrop({
        tree,
        rootPathId: "root",
        visibleItems: tree.flattenedItems.filter((item) => item.pathId !== "root"),
        activePathId: "active",
        overPathId: "group",
        horizontalOffset: 30,
      }),
    ).toEqual({
      accepted: true,
      destination: { parentPathId: "group", siblingIndex: 0, position: 0.1 },
    });
  });

  it("does not project an activity directly below root", () => {
    const tree = createTree();
    const result = resolvePlannerDrop({
      tree,
      rootPathId: "root",
      visibleItems: tree.flattenedItems.filter((item) => item.pathId !== "root"),
      activePathId: "active",
      overPathId: "region",
      horizontalOffset: -90,
    });

    expect(result.accepted).toBe(false);
  });
});

describe("removeActiveDescendants", () => {
  it("removes only the active node descendants during a drag", () => {
    const tree = createTree();

    expect(
      removeActiveDescendants(tree.flattenedItems, "day-one").map((item) => item.pathId),
    ).toEqual(["root", "region", "day-one", "day-two", "group"]);
  });
});
