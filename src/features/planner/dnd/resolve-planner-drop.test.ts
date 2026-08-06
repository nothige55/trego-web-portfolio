import { describe, expect, it } from "vitest";

import {
  isPlannerChildHover,
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
    day("day-three", "region", 0.3),
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

  it("keeps a group hover as a sibling drop until the child hover delay is satisfied", () => {
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
      destination: { parentPathId: "day-two", siblingIndex: 1, position: 0.2 },
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

  it("places a day before the hovered day after an expanded previous branch", () => {
    const tree = createTree();

    const result = resolvePlannerDrop({
      tree,
      rootPathId: "root",
      visibleItems: tree.flattenedItems.filter((item) => item.pathId !== "root"),
      activePathId: "day-three",
      overPathId: "day-two",
      horizontalOffset: 0,
    });

    expect(result.accepted).toBe(true);
    if (!result.accepted) {
      return;
    }
    expect(result.destination).toMatchObject({ parentPathId: "region", siblingIndex: 1 });
    expect(result.destination.position).toBeCloseTo(0.15);
  });
});

describe("isPlannerChildHover", () => {
  it("matches the legacy directional row-edge threshold", () => {
    expect(isPlannerChildHover({ overTop: 100, activeTop: 90, deltaY: 10 })).toBe(true);
    expect(isPlannerChildHover({ overTop: 100, activeTop: 110, deltaY: -10 })).toBe(true);
  });

  it("does not treat a row that the active item already passed as a child hover", () => {
    expect(isPlannerChildHover({ overTop: 100, activeTop: 120, deltaY: 10 })).toBe(false);
    expect(isPlannerChildHover({ overTop: 100, activeTop: 80, deltaY: -10 })).toBe(false);
  });
});

describe("removeActiveDescendants", () => {
  it("removes only the active node descendants during a drag", () => {
    const tree = createTree();

    expect(
      removeActiveDescendants(tree.flattenedItems, "day-one").map((item) => item.pathId),
    ).toEqual(["root", "region", "day-one", "day-two", "group", "day-three"]);
  });
});
