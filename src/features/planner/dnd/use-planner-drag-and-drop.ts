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
import type { PlannerDragDestination } from "@/features/planner/utils/build-planner-drag-projection";

const EMPTY_CHILD_DROP_DELAY = 800;
const COLLAPSED_EXPAND_DELAY = 1_000;
const EXPANDED_DROP_STABILITY_THRESHOLD = 7.5;

interface UsePlannerDragAndDropParams {
  readonly tree: PlannerTree;
  readonly rootPathId: PlannerNodePathId | null;
  readonly visibleItems: readonly FlattenedPlannerNode[];
  readonly expandedIds: ReadonlySet<PlannerNodePathId>;
  readonly expandNode: (pathId: PlannerNodePathId) => void;
  // 목록의 좌우 경계다. 포인터가 이 밖으로 나가면 놓을 자리가 없는 것으로 본다.
  readonly getListBounds?: () => Readonly<{ left: number; right: number }> | null;
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
  getListBounds,
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
  // 포인터가 목록 좌우 밖에 있는지다. 이때만 잡은 노드를 목록에서 빼서 보여 준다.
  const [isOutsideList, setIsOutsideList] = useState(false);
  // 지금 놓으면 들어갈 자리다. 경로 정보 미리보기가 이 값으로 이웃 관계를 다시 계산한다.
  const [dropDestination, setDropDestination] = useState<PlannerDragDestination | null>(null);
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
    setIsOutsideList(false);
    setDropDestination(null);
    setHorizontalOffset(0);
  }

  // 잡은 노드를 뺐다가 원래 자리에 도로 끼우는 목적지다.
  // 규칙 계산이 "unchanged"를 돌려줄 때, 목록을 원래 모습 그대로 보여 주려고 쓴다.
  function getCurrentDestination(pathId: PlannerNodePathId): PlannerDragDestination | null {
    const node = tree.entityMap.get(pathId);
    if (!node?.parentPathId) {
      return null;
    }

    const siblingIndex = (tree.childrenMap.get(node.parentPathId) ?? []).findIndex(
      (sibling) => sibling.pathId === pathId,
    );
    return siblingIndex < 0 ? null : { parentPathId: node.parentPathId, siblingIndex };
  }

  // closestCenter는 포인터가 어디에 있든 가장 가까운 행을 늘 하나 고른다. 그래서 목록을
  // 옆으로 벗어난 것과 목록 위에 있는 것을 구분하지 못한다. 포인터의 x를 직접 보고 가른다.
  function isPointerOutsideList(event: DragMoveEvent | DragEndEvent): boolean {
    const bounds = getListBounds?.();
    const activator = event.activatorEvent;
    if (!bounds || !(activator instanceof PointerEvent || activator instanceof MouseEvent)) {
      return false;
    }

    const pointerX = activator.clientX + event.delta.x;
    return pointerX < bounds.left || pointerX > bounds.right;
  }

  // dragMove는 포인터가 움직일 때마다 들어온다. 값이 같은데도 새 객체를 넣으면 매 이벤트마다
  // 리렌더가 나고, 그 사이 끼어든 렌더 때문에 dnd-kit이 낸 이동량이 행마다 어긋난다.
  function updateDropDestination(next: PlannerDragDestination | null): void {
    setDropDestination((previous) => {
      if (
        previous === next ||
        (previous?.parentPathId === next?.parentPathId &&
          previous?.siblingIndex === next?.siblingIndex)
      ) {
        return previous;
      }

      return next;
    });
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

    const isOutside = isPointerOutsideList(event);
    setIsOutsideList(isOutside);
    if (isOutside) {
      // 목록 밖에서는 잡은 노드가 잠시 빠진 것으로 보여 준다.
      clearHoverState();
      setIsSiblingDropActive(false);
      updateDropDestination(null);
      return;
    }

    if (!rootPathId || !activePathId || !event.over) {
      clearHoverState();
      setIsSiblingDropActive(false);
      updateDropDestination(null);
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
      updateDropDestination(childResult.destination);
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
    // 받아 주지 않는 자리 위에서는 목적지가 없다. 그때는 잡은 노드가 빠진 목록만 보여 준다.
    updateDropDestination(
      siblingResult.accepted
        ? siblingResult.destination
        : siblingResult.reason === "unchanged"
          ? getCurrentDestination(activePathId)
          : null,
    );
  }

  function handleDragEnd(event: DragEndEvent): void {
    // 목록 밖에서 놓으면 자리를 고르지 않은 것이므로 이동 없이 되돌린다.
    if (!rootPathId || !activePathId || !event.over || isPointerOutsideList(event)) {
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
    dropDestination,
    expandingTargetPathId,
    handleDragCancel: resetDragState,
    handleDragEnd,
    handleDragMove,
    handleDragStart,
    isOutsideList,
    isSiblingDropActive,
    sensors,
    sortableItems,
  };
}
