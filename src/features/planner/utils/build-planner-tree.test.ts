import { describe, expect, it } from "vitest";

import type {
  PlannerActivityNode,
  PlannerDayNode,
  PlannerFolderNode,
  PlannerNode,
} from "@/features/planner/types/planner-node";
import { buildPlannerTree } from "@/features/planner/utils/build-planner-tree";

function folder(
  pathId: string,
  parentPathId: string | null,
  position: number,
  folderType = "group",
): PlannerFolderNode {
  return {
    kind: "folder",
    id: `folder-${pathId}`,
    name: pathId,
    pathId,
    parentPathId,
    position,
    folderType,
  };
}

function day(
  pathId: string,
  parentPathId: string | null,
  position: number,
  color: string | null = null,
): PlannerDayNode {
  return {
    kind: "day",
    id: `day-${pathId}`,
    name: pathId,
    pathId,
    parentPathId,
    position,
    color,
  };
}

function activity(
  pathId: string,
  parentPathId: string | null,
  position: number,
): PlannerActivityNode {
  return {
    kind: "activity",
    id: `activity-${pathId}`,
    name: pathId,
    pathId,
    parentPathId,
    position,
    activityType: "place",
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

describe("buildPlannerTree", () => {
  it("connects a child that appears before its parent in the input", () => {
    const nodes = [activity("child", "parent", 0), day("parent", null, 0, "blue")];

    const result = buildPlannerTree(nodes);

    expect(result.flattenedItems.map(({ pathId, depth }) => ({ pathId, depth }))).toEqual([
      { pathId: "parent", depth: 0 },
      { pathId: "child", depth: 1 },
    ]);
    expect(result.entityMap.get("child")?.color).toBe("blue");
  });

  it("sorts siblings by position in childrenMap and flattenedItems", () => {
    const nodes = [
      day("root", null, 0),
      activity("third", "root", 2),
      activity("first", "root", 0),
      activity("second", "root", 1),
    ];

    const result = buildPlannerTree(nodes);

    expect(result.childrenMap.get("root")?.map((node) => node.pathId)).toEqual([
      "first",
      "second",
      "third",
    ]);
    expect(result.flattenedItems.map((node) => node.pathId)).toEqual([
      "root",
      "first",
      "second",
      "third",
    ]);
    expect(result.childrenMap.get("root")?.map((node) => node.siblingIndex)).toEqual([0, 1, 2]);
  });

  it("flattens multiple levels in depth-first order with depth and sibling indexes", () => {
    const nodes = [
      activity("day-one-second", "day-one", 1),
      activity("day-two-first", "day-two", 0),
      folder("root", null, 0),
      day("day-two", "root", 1, "green"),
      activity("day-one-first", "day-one", 0),
      day("day-one", "root", 0, "blue"),
    ];

    const result = buildPlannerTree(nodes);

    expect(
      result.flattenedItems.map(({ pathId, depth, siblingIndex }) => ({
        pathId,
        depth,
        siblingIndex,
      })),
    ).toEqual([
      { pathId: "root", depth: 0, siblingIndex: 0 },
      { pathId: "day-one", depth: 1, siblingIndex: 0 },
      { pathId: "day-one-first", depth: 2, siblingIndex: 0 },
      { pathId: "day-one-second", depth: 2, siblingIndex: 1 },
      { pathId: "day-two", depth: 1, siblingIndex: 1 },
      { pathId: "day-two-first", depth: 2, siblingIndex: 0 },
    ]);
  });

  it("treats an orphan as a root while preserving its missing parent reference", () => {
    const nodes = [activity("orphan-child", "orphan", 0), day("orphan", "missing", 1)];

    const result = buildPlannerTree(nodes);

    expect(result.flattenedItems.map(({ pathId, depth }) => ({ pathId, depth }))).toEqual([
      { pathId: "orphan", depth: 0 },
      { pathId: "orphan-child", depth: 1 },
    ]);
    expect(result.entityMap.get("orphan")?.parentPathId).toBe("missing");
    expect(result.childrenMap.get("missing")?.map((node) => node.pathId)).toEqual(["orphan"]);
    expect(result.childrenMap.has(null)).toBe(false);
  });

  it("removes empty regular folders but keeps empty wish folders", () => {
    const nodes = [
      folder("root", null, 0),
      folder("empty", "root", 0),
      folder("wish", "root", 1, "wish"),
    ];

    const result = buildPlannerTree(nodes);

    expect(result.flattenedItems.map((node) => node.pathId)).toEqual(["root", "wish"]);
    expect(result.entityMap.has("empty")).toBe(false);
    expect(result.childrenMap.get("root")?.map((node) => node.pathId)).toEqual(["wish"]);
    expect(result.entityMap.get("wish")?.siblingIndex).toBe(0);
  });

  it("keeps a folder that had a child before the empty-folder filter runs", () => {
    const nodes = [folder("parent", null, 0), folder("empty-child", "parent", 0)];

    const result = buildPlannerTree(nodes);

    expect(result.flattenedItems.map((node) => node.pathId)).toEqual(["parent"]);
    expect(result.childrenMap.has("parent")).toBe(false);
  });

  it("does not mutate the input array or node objects", () => {
    const mutableNodes: PlannerNode[] = [
      activity("later", "root", 1),
      day("root", null, 0, "purple"),
      activity("earlier", "root", 0),
    ];
    const originalSnapshot = structuredClone(mutableNodes);
    const nodes = Object.freeze(mutableNodes.map((node) => Object.freeze(node)));

    const result = buildPlannerTree(nodes);

    expect(nodes).toEqual(originalSnapshot);
    expect(result.flattenedItems.map((node) => node.pathId)).toEqual(["root", "earlier", "later"]);
    expect(result.flattenedItems.every((node) => !nodes.includes(node))).toBe(true);
  });
});
