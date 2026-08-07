import { arrayMove } from "@dnd-kit/sortable";

import {
  calculatePlannerDropDestination,
  type PlannerDropResult,
} from "@/features/planner/dnd/planner-drop-rules";
import type {
  FlattenedPlannerNode,
  PlannerNodePathId,
  PlannerTree,
} from "@/features/planner/types/planner-node";

const INDENTATION_WIDTH = 30;
const CHILD_DROP_VERTICAL_THRESHOLD = 7.5;

export interface ResolvePlannerDropInput {
  readonly tree: PlannerTree;
  readonly rootPathId: PlannerNodePathId;
  readonly visibleItems: readonly FlattenedPlannerNode[];
  readonly activePathId: PlannerNodePathId;
  readonly overPathId: PlannerNodePathId;
  readonly horizontalOffset: number;
}

interface PlannerChildHoverInput {
  readonly overTop: number;
  readonly activeTop: number;
  readonly deltaY: number;
}

function rejection(reason: "active-not-found" | "parent-not-found"): PlannerDropResult {
  return Object.freeze({ accepted: false, reason });
}

function siblingIndexAfter(
  tree: PlannerTree,
  parentPathId: PlannerNodePathId,
  activePathId: PlannerNodePathId,
  previousSiblingPathId: PlannerNodePathId,
): number | null {
  const siblings = (tree.childrenMap.get(parentPathId) ?? []).filter(
    (node) => node.pathId !== activePathId,
  );
  const previousIndex = siblings.findIndex((node) => node.pathId === previousSiblingPathId);
  return previousIndex < 0 ? null : previousIndex + 1;
}

function siblingIndexBefore(
  tree: PlannerTree,
  parentPathId: PlannerNodePathId,
  activePathId: PlannerNodePathId,
  nextSiblingPathId: PlannerNodePathId,
): number | null {
  const siblings = (tree.childrenMap.get(parentPathId) ?? []).filter(
    (node) => node.pathId !== activePathId,
  );
  const nextIndex = siblings.findIndex((node) => node.pathId === nextSiblingPathId);
  return nextIndex < 0 ? null : nextIndex;
}

function calculateSiblingDestination(
  tree: PlannerTree,
  rootPathId: PlannerNodePathId,
  activePathId: PlannerNodePathId,
  parentPathId: PlannerNodePathId | null,
  siblingIndex: number | null,
): PlannerDropResult {
  if (!parentPathId || siblingIndex === null) {
    return rejection("parent-not-found");
  }

  return calculatePlannerDropDestination(tree, {
    rootPathId,
    activePathId,
    parentPathId,
    siblingIndex,
  });
}

function findActiveSubtreeRange(
  visibleItems: readonly FlattenedPlannerNode[],
  activePathId: PlannerNodePathId,
): Readonly<{ start: number; end: number }> | null {
  const start = visibleItems.findIndex((item) => item.pathId === activePathId);
  if (start < 0) {
    return null;
  }

  const activeDepth = visibleItems[start].depth;
  let end = start + 1;

  while (end < visibleItems.length && visibleItems[end].depth > activeDepth) {
    end += 1;
  }

  return { start, end };
}

function collectTrailingCandidates(
  tree: PlannerTree,
  previousItem: FlattenedPlannerNode,
  activePathId: PlannerNodePathId,
): Array<Readonly<{ parentPathId: PlannerNodePathId; siblingIndex: number; depth: number }>> {
  const candidates = [];
  let currentItem: FlattenedPlannerNode | undefined = previousItem;

  while (currentItem?.parentPathId) {
    const siblingIndex = siblingIndexAfter(
      tree,
      currentItem.parentPathId,
      activePathId,
      currentItem.pathId,
    );

    if (siblingIndex !== null) {
      candidates.push({
        parentPathId: currentItem.parentPathId,
        siblingIndex,
        depth: currentItem.depth,
      });
    }

    currentItem = tree.entityMap.get(currentItem.parentPathId);
  }

  return candidates;
}

/**
 * 기존 Planner처럼 이동 방향에 따라 active 행의 leading edge가 over 행에 닿았을 때만
 * 컨테이너 child hover로 본다. 단순히 collision 대상이 같다는 이유로 자식 드롭을 열지 않는다.
 */
export function isPlannerChildHover({
  overTop,
  activeTop,
  deltaY,
}: PlannerChildHoverInput): boolean {
  return (
    (overTop - activeTop > -CHILD_DROP_VERTICAL_THRESHOLD && deltaY > 0) ||
    (overTop - activeTop < CHILD_DROP_VERTICAL_THRESHOLD && deltaY < 0)
  );
}

export function removeActiveDescendants(
  visibleItems: readonly FlattenedPlannerNode[],
  activePathId: PlannerNodePathId | null,
): FlattenedPlannerNode[] {
  if (!activePathId) {
    return [...visibleItems];
  }

  const range = findActiveSubtreeRange(visibleItems, activePathId);
  if (!range) {
    return [...visibleItems];
  }

  return [...visibleItems.slice(0, range.start + 1), ...visibleItems.slice(range.end)];
}

export function calculatePlannerDragFootprintHeight(
  visibleItems: readonly FlattenedPlannerNode[],
  activePathId: PlannerNodePathId,
  getItemHeight: (pathId: PlannerNodePathId) => number,
): number {
  const range = findActiveSubtreeRange(visibleItems, activePathId);
  if (!range || range.end === range.start + 1) {
    return 0;
  }

  return visibleItems
    .slice(range.start, range.end)
    .reduce((height, item) => height + getItemHeight(item.pathId), 0);
}

export function resolvePlannerDrop({
  tree,
  rootPathId,
  visibleItems,
  activePathId,
  overPathId,
  horizontalOffset,
}: ResolvePlannerDropInput): PlannerDropResult {
  const rootNode = tree.entityMap.get(rootPathId);
  const projectionItems =
    rootNode && !visibleItems.some((item) => item.pathId === rootPathId)
      ? [rootNode, ...visibleItems]
      : [...visibleItems];
  const activeIndex = projectionItems.findIndex((item) => item.pathId === activePathId);
  const overIndex = projectionItems.findIndex((item) => item.pathId === overPathId);

  if (activeIndex < 0) {
    return rejection("active-not-found");
  }

  if (overIndex < 0) {
    return rejection("parent-not-found");
  }

  const projectedItems = arrayMove(projectionItems, activeIndex, overIndex);
  const projectedActiveIndex = projectedItems.findIndex((item) => item.pathId === activePathId);
  const activeNode = tree.entityMap.get(activePathId);
  const previousItem = projectedItems[projectedActiveIndex - 1];
  const nextItem = projectedItems[projectedActiveIndex + 1];

  if (!activeNode) {
    return rejection("active-not-found");
  }

  if (!previousItem) {
    return rejection("parent-not-found");
  }

  // 같은 계층의 두 행 사이는 오직 두 행의 공통 부모 아래 형제 위치로 해석한다.
  if (nextItem && previousItem.depth === nextItem.depth) {
    return calculateSiblingDestination(
      tree,
      rootPathId,
      activePathId,
      previousItem.parentPathId,
      previousItem.parentPathId
        ? siblingIndexAfter(tree, previousItem.parentPathId, activePathId, previousItem.pathId)
        : null,
    );
  }

  // 부모 행과 첫 자식 사이는 next 행의 바로 앞 형제 위치다. 자식 drop은 hover 타이머가 별도로 맡는다.
  if (nextItem && previousItem.depth < nextItem.depth) {
    return calculateSiblingDestination(
      tree,
      rootPathId,
      activePathId,
      nextItem.parentPathId,
      nextItem.parentPathId
        ? siblingIndexBefore(tree, nextItem.parentPathId, activePathId, nextItem.pathId)
        : null,
    );
  }

  // 기존 Planner는 activity의 trailing drop 계층을 인접 activity와 동일하게 고정한다.
  // 따라서 group의 마지막 자식 뒤에서 X축 이동이 없을 때 상위 Day로 빠지지 않는다.
  if (activeNode.kind === "activity") {
    if (previousItem.kind === "activity" && previousItem.parentPathId) {
      return calculateSiblingDestination(
        tree,
        rootPathId,
        activePathId,
        previousItem.parentPathId,
        siblingIndexAfter(tree, previousItem.parentPathId, activePathId, previousItem.pathId),
      );
    }

    if (nextItem?.kind === "activity" && nextItem.parentPathId) {
      return calculateSiblingDestination(
        tree,
        rootPathId,
        activePathId,
        nextItem.parentPathId,
        siblingIndexBefore(tree, nextItem.parentPathId, activePathId, nextItem.pathId),
      );
    }

    return rejection("parent-not-found");
  }

  // branch 끝에서는 이전 행과 그 조상들의 "다음 형제"만 후보로 삼고 X축으로 계층을 고른다.
  // 이전 구현처럼 임의의 더 깊은 부모를 만들어 컨테이너 안으로 즉시 중첩시키지 않는다.
  const requestedDepth = activeNode.depth + Math.round(horizontalOffset / INDENTATION_WIDTH);
  const candidates = collectTrailingCandidates(tree, previousItem, activePathId).sort(
    (first, second) =>
      Math.abs(first.depth - requestedDepth) - Math.abs(second.depth - requestedDepth),
  );
  let lastResult: PlannerDropResult = rejection("parent-not-found");

  for (const candidate of candidates) {
    const result = calculatePlannerDropDestination(tree, {
      rootPathId,
      activePathId,
      parentPathId: candidate.parentPathId,
      siblingIndex: candidate.siblingIndex,
    });

    if (result.accepted || result.reason === "unchanged") {
      return result;
    }

    lastResult = result;
  }

  return lastResult;
}
