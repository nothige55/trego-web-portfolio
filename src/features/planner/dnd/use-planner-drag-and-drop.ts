import {
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useEffect, useMemo, useRef, useState } from "react";

import { calculatePlannerDropDestination } from "@/features/planner/dnd/planner-drop-rules";
import {
  isPlannerChildHover,
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
const EXPANDED_DROP_STABILITY_THRESHOLD = 7.5;

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
}

export function usePlannerDragAndDrop({
  tree,
  rootPathId,
  visibleItems,
  expandedIds,
  expandNode,
  moveNode,
}: UsePlannerDragAndDropParams) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );
  const [activePathId, setActivePathId] = useState<PlannerNodePathId | null>(null);
  const [childTargetPathId, setChildTargetPathId] = useState<PlannerNodePathId | null>(null);
  const [expandingTargetPathId, setExpandingTargetPathId] = useState<PlannerNodePathId | null>(
    null,
  );
  const [isSiblingDropActive, setIsSiblingDropActive] = useState(false);
  const [horizontalOffset, setHorizontalOffset] = useState(0);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverKeyRef = useRef<string | null>(null);
  const readyChildTargetPathIdRef = useRef<PlannerNodePathId | null>(null);
  const expandedTargetActiveTopRef = useRef<number | null>(null);
  const sortableItems = useMemo(
    () => removeActiveDescendants(visibleItems, activePathId),
    [activePathId, visibleItems],
  );

  function clearHoverState(): void {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    hoverKeyRef.current = null;
    readyChildTargetPathIdRef.current = null;
    setChildTargetPathId(null);
    setExpandingTargetPathId(null);
  }

  function resetDragState(): void {
    clearHoverState();
    expandedTargetActiveTopRef.current = null;
    setActivePathId(null);
    setIsSiblingDropActive(false);
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
    expandedTargetActiveTopRef.current = null;
    setActivePathId(pathId);
  }

  function shouldStabilizeExpandedTarget(activeTop: number | undefined): boolean {
    if (expandedTargetActiveTopRef.current === null) {
      return false;
    }

    if (
      activeTop !== undefined &&
      Math.abs(activeTop - expandedTargetActiveTopRef.current) > EXPANDED_DROP_STABILITY_THRESHOLD
    ) {
      expandedTargetActiveTopRef.current = null;
      return false;
    }

    return true;
  }

  function handleDragMove(event: DragMoveEvent): void {
    setHorizontalOffset(event.delta.x);

    if (!rootPathId || !activePathId || !event.over) {
      clearHoverState();
      setIsSiblingDropActive(false);
      return;
    }

    const overPathId = String(event.over.id);
    const activeTop = event.active.rect.current.translated?.top;
    const isChildHover =
      activeTop !== undefined &&
      isPlannerChildHover({
        overTop: event.over.rect.top,
        activeTop,
        deltaY: event.delta.y,
      });
    const children = (tree.childrenMap.get(overPathId) ?? []).filter(
      (node) => node.pathId !== activePathId,
    );
    const childResult = isChildHover
      ? calculatePlannerDropDestination(tree, {
          rootPathId,
          activePathId,
          parentPathId: overPathId,
          siblingIndex: children.length,
        })
      : null;

    if (childResult?.accepted && (children.length === 0 || !expandedIds.has(overPathId))) {
      setIsSiblingDropActive(false);
      const hoverKey = `child:${overPathId}`;
      if (hoverKeyRef.current === hoverKey) {
        return;
      }

      clearHoverState();
      hoverKeyRef.current = hoverKey;

      if (children.length > 0) {
        if (!expandedIds.has(overPathId)) {
          setExpandingTargetPathId(overPathId);
          hoverTimerRef.current = setTimeout(() => {
            setExpandingTargetPathId(null);
            expandedTargetActiveTopRef.current = activeTop ?? null;
            expandNode(overPathId);
            hoverTimerRef.current = null;
          }, COLLAPSED_EXPAND_DELAY);
        }
        return;
      }

      // 기존 Planner의 fill cue처럼 빈 컨테이너 진입 즉시 시각 상태를 켜고,
      // 실제 child drop 승인은 800ms 뒤에만 허용한다.
      setChildTargetPathId(overPathId);
      hoverTimerRef.current = setTimeout(() => {
        readyChildTargetPathIdRef.current = overPathId;
        hoverTimerRef.current = null;
      }, EMPTY_CHILD_DROP_DELAY);
      return;
    }

    if (shouldStabilizeExpandedTarget(activeTop)) {
      clearHoverState();
      setIsSiblingDropActive(false);
      return;
    }

    clearHoverState();
    const siblingResult = resolvePlannerDrop({
      tree,
      rootPathId,
      activePathId,
      overPathId,
      visibleItems: sortableItems,
      horizontalOffset: event.delta.x,
    });
    setIsSiblingDropActive(siblingResult.accepted || siblingResult.reason === "unchanged");
  }

  function handleDragEnd(event: DragEndEvent): void {
    if (!rootPathId || !activePathId || !event.over) {
      resetDragState();
      return;
    }

    const overPathId = String(event.over.id);
    const activeTop = event.active.rect.current.translated?.top;
    if (shouldStabilizeExpandedTarget(activeTop)) {
      resetDragState();
      return;
    }
    const isChildHover =
      activeTop !== undefined &&
      isPlannerChildHover({
        overTop: event.over.rect.top,
        activeTop,
        deltaY: event.delta.y,
      });
    const isReadyEmptyChildDrop = readyChildTargetPathIdRef.current === overPathId && isChildHover;
    const result = isReadyEmptyChildDrop
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
      if (isReadyEmptyChildDrop) {
        // 빈 대상은 이동 전에는 펼칠 자식이 없으므로, 트리 갱신 뒤에 펼친다.
        expandNode(result.destination.parentPathId);
      }
    }

    resetDragState();
  }

  return {
    activePathId,
    childTargetPathId,
    expandingTargetPathId,
    handleDragCancel: resetDragState,
    handleDragEnd,
    handleDragMove,
    handleDragStart,
    isSiblingDropActive,
    sensors,
    sortableItems,
  };
}
