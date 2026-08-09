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

function dragEvent(
  overPathId: string,
  {
    activeTop = 90,
    overTop = 100,
    deltaX = 0,
    deltaY = 10,
  }: {
    activeTop?: number;
    overTop?: number;
    deltaX?: number;
    deltaY?: number;
  } = {},
) {
  return {
    active: {
      id: "active",
      rect: { current: { translated: { top: activeTop } } },
    },
    over: { id: overPathId, rect: { top: overTop } },
    delta: { x: deltaX, y: deltaY },
  } as never;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("usePlannerDragAndDrop", () => {
  it("cancels a pending child drop without invoking the selection-affecting move", () => {
    vi.useFakeTimers();
    const { tree, visibleItems } = createFixture();
    const expandNode = vi.fn();
    const moveNode = vi.fn();
    const { result } = renderHook(() =>
      usePlannerDragAndDrop({
        tree,
        rootPathId: "root",
        visibleItems,
        expandedIds: new Set(["root", "region", "source"]),
        expandNode,
        moveNode,
      }),
    );

    act(() => {
      result.current.handleDragStart({ active: { id: "active" } } as never);
    });
    act(() => {
      result.current.handleDragMove(dragEvent("wish"));
    });
    expect(result.current.childTargetPathId).toBe("wish");

    act(() => {
      result.current.handleDragCancel();
      vi.advanceTimersByTime(800);
    });

    expect(result.current.activePathId).toBeNull();
    expect(result.current.childTargetPathId).toBeNull();
    expect(moveNode).not.toHaveBeenCalled();
    expect(expandNode).not.toHaveBeenCalled();
  });

  it("arms an empty child target after 800ms and applies the calculated destination", () => {
    vi.useFakeTimers();
    const { tree, visibleItems } = createFixture();
    const expandNode = vi.fn();
    const moveNode = vi.fn();
    const { result } = renderHook(() =>
      usePlannerDragAndDrop({
        tree,
        rootPathId: "root",
        visibleItems,
        expandedIds: new Set(["root", "region", "source"]),
        expandNode,
        moveNode,
      }),
    );

    act(() => {
      result.current.handleDragStart({ active: { id: "active" } } as never);
    });
    act(() => {
      result.current.handleDragMove(dragEvent("wish"));
    });

    expect(result.current.childTargetPathId).toBe("wish");

    act(() => {
      vi.advanceTimersByTime(800);
    });

    act(() => {
      result.current.handleDragEnd(dragEvent("wish"));
    });

    expect(moveNode).toHaveBeenCalledWith("active", {
      parentPathId: "wish",
      siblingIndex: 0,
      position: 0.1,
    });
    expect(expandNode).toHaveBeenCalledWith("wish");
    expect(moveNode.mock.invocationCallOrder[0]).toBeLessThan(
      expandNode.mock.invocationCallOrder[0],
    );
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
      }),
    );

    act(() => {
      result.current.handleDragStart({ active: { id: "active" } } as never);
    });
    act(() => {
      result.current.handleDragMove(dragEvent("target"));
      vi.advanceTimersByTime(999);
    });
    expect(result.current.expandingTargetPathId).toBe("target");
    expect(expandNode).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(expandNode).toHaveBeenCalledWith("target");
    expect(result.current.expandingTargetPathId).toBeNull();
  });

  it("ignores layout-only movement immediately after a hover-expanded target opens", () => {
    vi.useFakeTimers();
    const { tree, visibleItems } = createFixture();
    const expandNode = vi.fn();
    const moveNode = vi.fn();
    const { result, rerender } = renderHook(
      ({ expandedIds }: { expandedIds: ReadonlySet<string> }) =>
        usePlannerDragAndDrop({
          tree,
          rootPathId: "root",
          visibleItems,
          expandedIds,
          expandNode,
          moveNode,
        }),
      { initialProps: { expandedIds: new Set(["root", "region", "source"]) } },
    );

    act(() => {
      result.current.handleDragStart({ active: { id: "active" } } as never);
    });
    act(() => {
      result.current.handleDragMove(dragEvent("target", { activeTop: 90 }));
      vi.advanceTimersByTime(1_000);
    });
    rerender({ expandedIds: new Set(["root", "region", "source", "target"]) });

    act(() => {
      result.current.handleDragMove(dragEvent("target", { activeTop: 94 }));
    });
    expect(result.current.isSiblingDropActive).toBe(false);

    act(() => {
      result.current.handleDragEnd(dragEvent("target", { activeTop: 94 }));
    });
    expect(moveNode).not.toHaveBeenCalled();
  });

  it("resumes drop projection after moving beyond the expanded-target threshold", () => {
    vi.useFakeTimers();
    const { tree, visibleItems } = createFixture();
    const { result, rerender } = renderHook(
      ({ expandedIds }: { expandedIds: ReadonlySet<string> }) =>
        usePlannerDragAndDrop({
          tree,
          rootPathId: "root",
          visibleItems,
          expandedIds,
          expandNode: vi.fn(),
          moveNode: vi.fn(),
        }),
      { initialProps: { expandedIds: new Set(["root", "region", "source"]) } },
    );

    act(() => {
      result.current.handleDragStart({ active: { id: "active" } } as never);
    });
    act(() => {
      result.current.handleDragMove(dragEvent("target", { activeTop: 90 }));
      vi.advanceTimersByTime(1_000);
    });
    rerender({ expandedIds: new Set(["root", "region", "source", "target"]) });

    act(() => {
      result.current.handleDragMove(dragEvent("target", { activeTop: 98 }));
    });
    expect(result.current.isSiblingDropActive).toBe(true);
  });

  it("does not arm a child drop after the active row has passed the target edge", () => {
    vi.useFakeTimers();
    const { tree, visibleItems } = createFixture();
    const moveNode = vi.fn();
    const { result } = renderHook(() =>
      usePlannerDragAndDrop({
        tree,
        rootPathId: "root",
        visibleItems,
        expandedIds: new Set(["root", "region", "source"]),
        expandNode: vi.fn(),
        moveNode,
      }),
    );

    act(() => {
      result.current.handleDragStart({ active: { id: "active" } } as never);
    });
    act(() => {
      result.current.handleDragMove(dragEvent("wish", { activeTop: 120 }));
      vi.advanceTimersByTime(800);
    });

    expect(result.current.childTargetPathId).toBeNull();

    act(() => {
      result.current.handleDragEnd(dragEvent("wish", { activeTop: 120 }));
    });
    expect(moveNode).not.toHaveBeenCalled();
  });
});
