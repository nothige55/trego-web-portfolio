import { describe, expect, it } from "vitest";

import {
  calculatePlannerDropDestination,
  isPlannerChildAllowed,
} from "@/features/planner/dnd/planner-drop-rules";
import type {
  FlattenedPlannerNode,
  PlannerActivityNode,
  PlannerDayNode,
  PlannerFolderNode,
  PlannerParentPathId,
  PlannerTree,
} from "@/features/planner/types/planner-node";

function folder(
  pathId: string,
  parentPathId: string | null,
  position: number,
  folderType: string | null = "default",
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

function day(pathId: string, parentPathId: string | null, position: number): PlannerDayNode {
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

function activity(
  pathId: string,
  parentPathId: string | null,
  position: number,
  activityType: string | null = "single",
): PlannerActivityNode {
  return {
    kind: "activity",
    id: `activity-${pathId}`,
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

function flattened<T extends PlannerFolderNode | PlannerDayNode | PlannerActivityNode>(
  node: T,
  depth = 0,
  siblingIndex = 0,
): FlattenedPlannerNode {
  return {
    ...node,
    depth,
    siblingIndex,
    color: node.color ?? null,
  };
}

function plannerTree(nodes: readonly FlattenedPlannerNode[]): PlannerTree {
  const entityMap = new Map(nodes.map((node) => [node.pathId, node]));
  const childrenMap = new Map<PlannerParentPathId, FlattenedPlannerNode[]>();

  for (const node of nodes) {
    const siblings = childrenMap.get(node.parentPathId);
    if (siblings) {
      siblings.push(node);
    } else {
      childrenMap.set(node.parentPathId, [node]);
    }
  }

  return { entityMap, childrenMap, flattenedItems: nodes };
}

describe("isPlannerChildAllowed", () => {
  const defaultFolder = folder("default", null, 0);
  const wishFolder = folder("wish", "default", 0.1, "wish");
  const regularDay = day("day", "default", 0.2);
  const groupActivity = activity("group", "day", 0.1, "group");
  const singleActivity = activity("single", "day", 0.2);

  it("allows only folders and days under a default folder", () => {
    expect(isPlannerChildAllowed(defaultFolder, wishFolder)).toBe(true);
    expect(isPlannerChildAllowed(defaultFolder, regularDay)).toBe(true);
    expect(isPlannerChildAllowed(defaultFolder, singleActivity)).toBe(false);
  });

  it("allows only activities under wish folders and days", () => {
    expect(isPlannerChildAllowed(wishFolder, singleActivity)).toBe(true);
    expect(isPlannerChildAllowed(wishFolder, groupActivity)).toBe(true);
    expect(isPlannerChildAllowed(wishFolder, regularDay)).toBe(false);
    expect(isPlannerChildAllowed(regularDay, singleActivity)).toBe(true);
    expect(isPlannerChildAllowed(regularDay, groupActivity)).toBe(true);
    expect(isPlannerChildAllowed(regularDay, defaultFolder)).toBe(false);
  });

  it("allows only single activities under a group activity", () => {
    expect(isPlannerChildAllowed(groupActivity, singleActivity)).toBe(true);
    expect(isPlannerChildAllowed(groupActivity, groupActivity)).toBe(false);
    expect(isPlannerChildAllowed(groupActivity, activity("unknown", "day", 0.3, null))).toBe(false);
    expect(isPlannerChildAllowed(singleActivity, singleActivity)).toBe(false);
  });

  it("rejects children under an unsupported folder type", () => {
    expect(isPlannerChildAllowed(folder("other", "default", 0.3, "archive"), regularDay)).toBe(
      false,
    );
  });
});

describe("calculatePlannerDropDestination", () => {
  it("calculates a midpoint from the full PlannerTree without mutating it", () => {
    const mutableNodes = [
      flattened(folder("root", null, 0), 0, 0),
      flattened(day("day", "root", 0.1), 1, 0),
      flattened(activity("first", "day", 10), 2, 0),
      flattened(activity("second", "day", 20), 2, 1),
      flattened(folder("wish", "root", 0.2, "wish"), 1, 1),
      flattened(activity("active", "wish", 0.1), 2, 0),
    ];
    const originalSnapshot = structuredClone(mutableNodes);
    const nodes = Object.freeze(mutableNodes.map((node) => Object.freeze(node)));
    const tree = plannerTree(nodes);

    const result = calculatePlannerDropDestination(tree, {
      rootPathId: "root",
      activePathId: "active",
      parentPathId: "day",
      siblingIndex: 1,
    });

    expect(result).toEqual({
      accepted: true,
      destination: { parentPathId: "day", siblingIndex: 1, position: 15 },
    });
    expect(tree.flattenedItems).toEqual(originalSnapshot);
    expect(Object.isFrozen(result)).toBe(true);
    if (result.accepted) {
      expect(Object.isFrozen(result.destination)).toBe(true);
    }
  });

  it("uses the legacy 0.1 step for empty and trailing destinations", () => {
    const emptyTree = plannerTree([
      flattened(folder("root", null, 0)),
      flattened(folder("wish", "root", 0.1, "wish"), 1),
      flattened(day("source", "root", 0.2), 1, 1),
      flattened(activity("active", "source", 0.1), 2),
    ]);

    expect(
      calculatePlannerDropDestination(emptyTree, {
        rootPathId: "root",
        activePathId: "active",
        parentPathId: "wish",
        siblingIndex: 0,
      }),
    ).toEqual({
      accepted: true,
      destination: { parentPathId: "wish", siblingIndex: 0, position: 0.1 },
    });

    const populatedTree = plannerTree([
      ...emptyTree.flattenedItems,
      flattened(activity("existing", "wish", 10), 2),
    ]);

    expect(
      calculatePlannerDropDestination(populatedTree, {
        rootPathId: "root",
        activePathId: "active",
        parentPathId: "wish",
        siblingIndex: 0,
      }),
    ).toEqual({
      accepted: true,
      destination: { parentPathId: "wish", siblingIndex: 0, position: 5 },
    });
    expect(
      calculatePlannerDropDestination(populatedTree, {
        rootPathId: "root",
        activePathId: "active",
        parentPathId: "wish",
        siblingIndex: 1,
      }),
    ).toEqual({
      accepted: true,
      destination: { parentPathId: "wish", siblingIndex: 1, position: 10.1 },
    });
  });

  it("removes the active node before resolving a same-parent sibling index", () => {
    const tree = plannerTree([
      flattened(folder("root", null, 0)),
      flattened(day("day", "root", 0.1), 1),
      flattened(activity("first", "day", 0.1), 2, 0),
      flattened(activity("active", "day", 0.2), 2, 1),
      flattened(activity("last", "day", 0.3), 2, 2),
    ]);

    expect(
      calculatePlannerDropDestination(tree, {
        rootPathId: "root",
        activePathId: "active",
        parentPathId: "day",
        siblingIndex: 2,
      }),
    ).toEqual({
      accepted: true,
      destination: { parentPathId: "day", siblingIndex: 2, position: 0.4 },
    });
  });

  it("keeps the actual root fixed and allows only folders or days directly below it", () => {
    const tree = plannerTree([
      flattened(folder("root", null, 0)),
      flattened(folder("folder", "root", 0.1), 1),
      flattened(day("day", "folder", 0.1), 2),
      flattened(activity("activity", "day", 0.1), 3),
    ]);

    expect(
      calculatePlannerDropDestination(tree, {
        rootPathId: "root",
        activePathId: "day",
        parentPathId: "root",
        siblingIndex: 1,
      }),
    ).toEqual({
      accepted: true,
      destination: { parentPathId: "root", siblingIndex: 1, position: 0.2 },
    });
    expect(
      calculatePlannerDropDestination(tree, {
        rootPathId: "root",
        activePathId: "activity",
        parentPathId: "root",
        siblingIndex: 1,
      }),
    ).toEqual({ accepted: false, reason: "root-activity" });
    expect(
      calculatePlannerDropDestination(tree, {
        rootPathId: "root",
        activePathId: "root",
        parentPathId: "folder",
        siblingIndex: 0,
      }),
    ).toEqual({ accepted: false, reason: "root-node" });
  });

  it("rejects an unknown or non-root rootPathId", () => {
    const tree = plannerTree([
      flattened(folder("root", null, 0)),
      flattened(folder("folder", "root", 0.1), 1),
      flattened(day("day", "folder", 0.1), 2),
    ]);

    expect(
      calculatePlannerDropDestination(tree, {
        rootPathId: "missing",
        activePathId: "day",
        parentPathId: "root",
        siblingIndex: 1,
      }),
    ).toEqual({ accepted: false, reason: "root-not-found" });
    expect(
      calculatePlannerDropDestination(tree, {
        rootPathId: "folder",
        activePathId: "day",
        parentPathId: "root",
        siblingIndex: 1,
      }),
    ).toEqual({ accepted: false, reason: "root-not-found" });
  });

  it("rejects a destination outside the selected project root", () => {
    const tree = plannerTree([
      flattened(folder("root", null, 0)),
      flattened(day("day", "root", 0.1), 1),
      flattened(folder("other-root", null, 1)),
      flattened(folder("other-folder", "other-root", 0.1), 1),
    ]);

    expect(
      calculatePlannerDropDestination(tree, {
        rootPathId: "root",
        activePathId: "day",
        parentPathId: "other-folder",
        siblingIndex: 0,
      }),
    ).toEqual({ accepted: false, reason: "outside-root" });
  });

  it("rejects an incompatible parent-child pair", () => {
    const tree = plannerTree([
      flattened(folder("root", null, 0)),
      flattened(folder("folder", "root", 0.1), 1),
      flattened(day("day", "folder", 0.1), 2),
      flattened(activity("activity", "day", 0.1), 3),
    ]);

    expect(
      calculatePlannerDropDestination(tree, {
        rootPathId: "root",
        activePathId: "activity",
        parentPathId: "folder",
        siblingIndex: 1,
      }),
    ).toEqual({ accepted: false, reason: "invalid-child-kind" });
  });

  it("rejects moving a node under itself or any of its descendants", () => {
    const tree = plannerTree([
      flattened(folder("root", null, 0)),
      flattened(folder("parent", "root", 0.1), 1),
      flattened(folder("child", "parent", 0.1), 2),
      flattened(day("grandchild", "child", 0.1), 3),
    ]);

    expect(
      calculatePlannerDropDestination(tree, {
        rootPathId: "root",
        activePathId: "parent",
        parentPathId: "parent",
        siblingIndex: 0,
      }),
    ).toEqual({ accepted: false, reason: "cycle" });
    expect(
      calculatePlannerDropDestination(tree, {
        rootPathId: "root",
        activePathId: "parent",
        parentPathId: "grandchild",
        siblingIndex: 0,
      }),
    ).toEqual({ accepted: false, reason: "cycle" });
  });

  it("rejects missing nodes and out-of-range or fractional indexes", () => {
    const tree = plannerTree([
      flattened(folder("root", null, 0)),
      flattened(day("day", "root", 0.1), 1),
    ]);

    expect(
      calculatePlannerDropDestination(tree, {
        rootPathId: "root",
        activePathId: "missing",
        parentPathId: "root",
        siblingIndex: 0,
      }),
    ).toEqual({ accepted: false, reason: "active-not-found" });
    expect(
      calculatePlannerDropDestination(tree, {
        rootPathId: "root",
        activePathId: "day",
        parentPathId: "missing",
        siblingIndex: 0,
      }),
    ).toEqual({ accepted: false, reason: "parent-not-found" });

    for (const siblingIndex of [-1, 0.5, 2]) {
      expect(
        calculatePlannerDropDestination(tree, {
          rootPathId: "root",
          activePathId: "day",
          parentPathId: "root",
          siblingIndex,
        }),
      ).toEqual({ accepted: false, reason: "invalid-sibling-index" });
    }
  });

  it("returns unchanged for the same parent and post-removal sibling index", () => {
    const tree = plannerTree([
      flattened(folder("root", null, 0)),
      flattened(day("day", "root", 0.1), 1),
      flattened(activity("first", "day", 0.1), 2, 0),
      flattened(activity("active", "day", 0.2), 2, 1),
      flattened(activity("last", "day", 0.3), 2, 2),
    ]);

    expect(
      calculatePlannerDropDestination(tree, {
        rootPathId: "root",
        activePathId: "active",
        parentPathId: "day",
        siblingIndex: 1,
      }),
    ).toEqual({ accepted: false, reason: "unchanged" });
  });

  it("rejects a destination when adjacent positions cannot produce a strict midpoint", () => {
    const tree = plannerTree([
      flattened(folder("root", null, 0)),
      flattened(day("source", "root", 0.1), 1),
      flattened(day("target", "root", 0.2), 1, 1),
      flattened(activity("active", "source", 0.1), 2),
      flattened(activity("first", "target", 10), 2),
      flattened(activity("second", "target", 10), 2, 1),
    ]);

    expect(
      calculatePlannerDropDestination(tree, {
        rootPathId: "root",
        activePathId: "active",
        parentPathId: "target",
        siblingIndex: 1,
      }),
    ).toEqual({ accepted: false, reason: "position-unavailable" });
  });
});
