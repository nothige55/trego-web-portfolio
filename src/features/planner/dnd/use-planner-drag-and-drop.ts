import {
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useEffect, useMemo, useRef, useState } from "react";

import { calculatePlannerDropDestination } from "@/features/planner/dnd/planner-drop-rules";
import {
  removeActiveDescendants,
  resolvePlannerDrop,
} from "@/features/planner/dnd/resolve-planner-drop";
import type {
  FlattenedPlannerNode,
  PlannerNodePathId,
  PlannerTree,
} from "@/features/planner/types/planner-node";

const EMPTY_CHILD_DROP_DELAY = 800;
const COLLAPSED_EXPAND_DELAY = 1_000;

interface UsePlannerDragAndDropParams {
  readonly tree: PlannerTree;
  readonly rootPathId: PlannerNodePathId | null;
  readonly visibleItems: readonly FlattenedPlannerNode[];
  readonly expandedIds: ReadonlySet<PlannerNodePathId>;
  readonly expandNode: (pathId: PlannerNodePathId) => void;
  readonly moveNode: (
    pathId: PlannerNodePathId,
    destination: {
      readonly parentPathId: PlannerNodePathId;
      readonly siblingIndex: number;
      readonly position: number;
    },
  ) => void;
  readonly selectItem: (pathId: PlannerNodePathId) => void;
}

export function usePlannerDragAndDrop({
  tree,
  rootPathId,
  visibleItems,
  expandedIds,
  expandNode,
  moveNode,
  selectItem,
}: UsePlannerDragAndDropParams) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );
  const [activePathId, setActivePathId] = useState<PlannerNodePathId | null>(null);
  const [childTargetPathId, setChildTargetPathId] = useState<PlannerNodePathId | null>(null);
  const [horizontalOffset, setHorizontalOffset] = useState(0);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overPathIdRef = useRef<PlannerNodePathId | null>(null);
  const childTargetPathIdRef = useRef<PlannerNodePathId | null>(null);
  const sortableItems = useMemo(
    () => removeActiveDescendants(visibleItems, activePathId),
    [activePathId, visibleItems],
  );

  function clearHoverState(): void {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    childTargetPathIdRef.current = null;
    setChildTargetPathId(null);
  }

  function resetDragState(): void {
    clearHoverState();
    overPathIdRef.current = null;
    setActivePathId(null);
    setHorizontalOffset(0);
  }

  useEffect(
    () => () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
    },
    [],
  );

  function handleDragStart(event: DragStartEvent): void {
    const pathId = String(event.active.id);
    setActivePathId(pathId);
    selectItem(pathId);
  }

  function handleDragMove(event: DragMoveEvent): void {
    setHorizontalOffset(event.delta.x);
  }

  function handleDragOver(event: DragOverEvent): void {
    if (!rootPathId || !activePathId || !event.over) {
      clearHoverState();
      return;
    }

    const overPathId = String(event.over.id);
    if (overPathIdRef.current === overPathId) {
      return;
    }

    clearHoverState();
    overPathIdRef.current = overPathId;
    const children = (tree.childrenMap.get(overPathId) ?? []).filter(
      (node) => node.pathId !== activePathId,
    );
    const result = calculatePlannerDropDestination(tree, {
      rootPathId,
      activePathId,
      parentPathId: overPathId,
      siblingIndex: children.length,
    });

    if (!result.accepted) {
      return;
    }

    if (children.length > 0) {
      if (!expandedIds.has(overPathId)) {
        hoverTimerRef.current = setTimeout(() => {
          expandNode(overPathId);
          hoverTimerRef.current = null;
        }, COLLAPSED_EXPAND_DELAY);
      }
      return;
    }

    hoverTimerRef.current = setTimeout(() => {
      childTargetPathIdRef.current = overPathId;
      setChildTargetPathId(overPathId);
      hoverTimerRef.current = null;
    }, EMPTY_CHILD_DROP_DELAY);
  }

  function handleDragEnd(event: DragEndEvent): void {
    if (!rootPathId || !activePathId || !event.over) {
      resetDragState();
      return;
    }

    const overPathId = String(event.over.id);
    const result =
      childTargetPathIdRef.current === overPathId
        ? calculatePlannerDropDestination(tree, {
            rootPathId,
            activePathId,
            parentPathId: overPathId,
            siblingIndex: (tree.childrenMap.get(overPathId) ?? []).filter(
              (node) => node.pathId !== activePathId,
            ).length,
          })
        : resolvePlannerDrop({
            tree,
            rootPathId,
            visibleItems: sortableItems,
            activePathId,
            overPathId,
            horizontalOffset,
          });

    if (result.accepted) {
      moveNode(activePathId, result.destination);
    }

    resetDragState();
  }

  return {
    activePathId,
    childTargetPathId,
    handleDragCancel: resetDragState,
    handleDragEnd,
    handleDragMove,
    handleDragOver,
    handleDragStart,
    sensors,
    sortableItems,
  };
}
