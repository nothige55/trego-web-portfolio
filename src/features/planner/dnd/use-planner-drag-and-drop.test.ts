import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { usePlannerDragAndDrop } from "@/features/planner/dnd/use-planner-drag-and-drop";
import type {
  PlannerActivityNode,
  PlannerDayNode,
  PlannerFolderNode,
} from "@/features/planner/types/planner-node";
import { buildPlannerTree } from "@/features/planner/utils/build-planner-tree";

function folder(
  pathId: string,
  parentPathId: string | null,
  position: number,
  folderType = "default",
): PlannerFolderNode {
  return {
    kind: "folder",
    id: pathId,
    name: pathId,
    pathId,
    parentPathId,
    position,
    folderType,
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

function activity(pathId: string, parentPathId: string, position: number): PlannerActivityNode {
  return {
    kind: "activity",
    id: pathId,
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

function createFixture() {
  const tree = buildPlannerTree([
    folder("root", null, 0),
    folder("wish", "root", 0.1, "wish"),
    folder("region", "root", 0.2),
    day("source", "region", 0.1),
    activity("active", "source", 0.1),
    day("target", "region", 0.2),
    activity("existing", "target", 0.1),
  ]);

  return {
    tree,
    visibleItems: tree.flattenedItems.filter((node) => node.pathId !== "root"),
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("usePlannerDragAndDrop", () => {
  it("arms an empty child target after 800ms and applies the calculated destination", () => {
    vi.useFakeTimers();
    const { tree, visibleItems } = createFixture();
    const expandNode = vi.fn();
    const moveNode = vi.fn();
    const selectItem = vi.fn();
    const { result } = renderHook(() =>
      usePlannerDragAndDrop({
        tree,
        rootPathId: "root",
        visibleItems,
        expandedIds: new Set(["root", "region", "source"]),
        expandNode,
        moveNode,
        selectItem,
      }),
    );

    act(() => {
      result.current.handleDragStart({ active: { id: "active" } } as never);
    });
    act(() => {
      result.current.handleDragOver({ over: { id: "wish" } } as never);
      vi.advanceTimersByTime(800);
    });

    expect(result.current.childTargetPathId).toBe("wish");

    act(() => {
      result.current.handleDragEnd({ over: { id: "wish" } } as never);
    });

    expect(selectItem).toHaveBeenCalledWith("active");
    expect(moveNode).toHaveBeenCalledWith("active", {
      parentPathId: "wish",
      siblingIndex: 0,
      position: 0.1,
    });
  });

  it("expands a collapsed container with children after one second", () => {
    vi.useFakeTimers();
    const { tree, visibleItems } = createFixture();
    const expandNode = vi.fn();
    const { result } = renderHook(() =>
      usePlannerDragAndDrop({
        tree,
        rootPathId: "root",
        visibleItems,
        expandedIds: new Set(["root", "region", "source"]),
        expandNode,
        moveNode: vi.fn(),
        selectItem: vi.fn(),
      }),
    );

    act(() => {
      result.current.handleDragStart({ active: { id: "active" } } as never);
    });
    act(() => {
      result.current.handleDragOver({ over: { id: "target" } } as never);
      vi.advanceTimersByTime(999);
    });
    expect(expandNode).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(expandNode).toHaveBeenCalledWith("target");
  });
});
