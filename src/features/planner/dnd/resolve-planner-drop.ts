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

export interface ResolvePlannerDropInput {
  readonly tree: PlannerTree;
  readonly rootPathId: PlannerNodePathId;
  readonly visibleItems: readonly FlattenedPlannerNode[];
  readonly activePathId: PlannerNodePathId;
  readonly overPathId: PlannerNodePathId;
  readonly horizontalOffset: number;
}

function rejection(reason: "active-not-found" | "parent-not-found"): PlannerDropResult {
  return Object.freeze({ accepted: false, reason });
}

function findParentPathId(
  items: readonly FlattenedPlannerNode[],
  activeIndex: number,
  depth: number,
  rootPathId: PlannerNodePathId,
): PlannerNodePathId | null {
  if (depth === 1) {
    return rootPathId;
  }

  for (let index = activeIndex - 1; index >= 0; index -= 1) {
    const candidate = items[index];

    if (candidate.depth === depth) {
      return candidate.parentPathId;
    }

    if (candidate.depth === depth - 1) {
      return candidate.pathId;
    }
  }

  return null;
}

function findSiblingIndex(
  tree: PlannerTree,
  items: readonly FlattenedPlannerNode[],
  activeIndex: number,
  activePathId: PlannerNodePathId,
  parentPathId: PlannerNodePathId,
  depth: number,
): number {
  const siblings = (tree.childrenMap.get(parentPathId) ?? []).filter(
    (node) => node.pathId !== activePathId,
  );
  const previousSibling = items
    .slice(0, activeIndex)
    .toReversed()
    .find((item) => item.depth === depth && item.parentPathId === parentPathId);

  if (!previousSibling) {
    return 0;
  }

  const previousIndex = siblings.findIndex((item) => item.pathId === previousSibling.pathId);
  return previousIndex < 0 ? 0 : previousIndex + 1;
}

export function removeActiveDescendants(
  visibleItems: readonly FlattenedPlannerNode[],
  activePathId: PlannerNodePathId | null,
): FlattenedPlannerNode[] {
  if (!activePathId) {
    return [...visibleItems];
  }

  const activeIndex = visibleItems.findIndex((item) => item.pathId === activePathId);
  if (activeIndex < 0) {
    return [...visibleItems];
  }

  const activeDepth = visibleItems[activeIndex].depth;
  let descendantEndIndex = activeIndex + 1;

  while (
    descendantEndIndex < visibleItems.length &&
    visibleItems[descendantEndIndex].depth > activeDepth
  ) {
    descendantEndIndex += 1;
  }

  return [...visibleItems.slice(0, activeIndex + 1), ...visibleItems.slice(descendantEndIndex)];
}

export function resolvePlannerDrop({
  tree,
  rootPathId,
  visibleItems,
  activePathId,
  overPathId,
  horizontalOffset,
}: ResolvePlannerDropInput): PlannerDropResult {
  const activeIndex = visibleItems.findIndex((item) => item.pathId === activePathId);
  const overIndex = visibleItems.findIndex((item) => item.pathId === overPathId);

  if (activeIndex < 0) {
    return rejection("active-not-found");
  }

  if (overIndex < 0) {
    return rejection("parent-not-found");
  }

  const projectedItems = arrayMove([...visibleItems], activeIndex, overIndex);
  const projectedActiveIndex = projectedItems.findIndex((item) => item.pathId === activePathId);
  const activeNode = tree.entityMap.get(activePathId);

  if (!activeNode) {
    return rejection("active-not-found");
  }

  const previousItem = projectedItems[projectedActiveIndex - 1];
  const nextItem = projectedItems[projectedActiveIndex + 1];
  const maximumDepth = previousItem ? previousItem.depth + 1 : 1;
  const minimumDepth = Math.min(nextItem?.depth ?? 1, maximumDepth);
  const requestedDepth = Math.min(
    maximumDepth,
    Math.max(minimumDepth, activeNode.depth + Math.round(horizontalOffset / INDENTATION_WIDTH)),
  );
  const candidateDepths = Array.from(
    { length: maximumDepth - minimumDepth + 1 },
    (_, index) => minimumDepth + index,
  ).sort(
    (first, second) =>
      Math.abs(first - requestedDepth) - Math.abs(second - requestedDepth) || second - first,
  );
  let lastResult: PlannerDropResult = rejection("parent-not-found");

  for (const depth of candidateDepths) {
    const parentPathId = findParentPathId(projectedItems, projectedActiveIndex, depth, rootPathId);
    if (!parentPathId) {
      continue;
    }

    const siblingIndex = findSiblingIndex(
      tree,
      projectedItems,
      projectedActiveIndex,
      activePathId,
      parentPathId,
      depth,
    );
    const result = calculatePlannerDropDestination(tree, {
      rootPathId,
      activePathId,
      parentPathId,
      siblingIndex,
    });

    if (result.accepted || result.reason === "unchanged") {
      return result;
    }

    lastResult = result;
  }

  return lastResult;
}
