import type {
  FlattenedPlannerNode,
  PlannerNodePathId,
  PlannerParentPathId,
} from "@/features/planner/types/planner-node";

type SelectionOptions = {
  // Shift 범위는 접힌 자손을 제외한 현재 화면 순서여야 한다.
  readonly flattenedItems: readonly FlattenedPlannerNode[];
  readonly currentItem: FlattenedPlannerNode;
  readonly lastSelectedItem: FlattenedPlannerNode;
  readonly childrenMap: ReadonlyMap<PlannerParentPathId, readonly FlattenedPlannerNode[]>;
  readonly entityMap: ReadonlyMap<PlannerNodePathId, FlattenedPlannerNode>;
};

export function getShiftSelectionRange(
  flattenedItems: readonly FlattenedPlannerNode[],
  currentItem: FlattenedPlannerNode,
  lastSelectedItem: FlattenedPlannerNode,
): FlattenedPlannerNode[] {
  const currentIndex = flattenedItems.findIndex((item) => item.pathId === currentItem.pathId);
  const lastIndex = flattenedItems.findIndex((item) => item.pathId === lastSelectedItem.pathId);

  if (currentIndex < 0 || lastIndex < 0) {
    return [currentItem];
  }

  const startIndex = Math.min(currentIndex, lastIndex);
  const endIndex = Math.max(currentIndex, lastIndex);
  return flattenedItems.slice(startIndex, endIndex + 1);
}

function isSelectionEndpoint(
  item: FlattenedPlannerNode,
  currentItem: FlattenedPlannerNode,
  lastSelectedItem: FlattenedPlannerNode,
): boolean {
  return item.pathId === currentItem.pathId || item.pathId === lastSelectedItem.pathId;
}

function getInitialSelectionIds(
  visibleItems: readonly FlattenedPlannerNode[],
  selectionRange: readonly FlattenedPlannerNode[],
  currentItem: FlattenedPlannerNode,
  lastSelectedItem: FlattenedPlannerNode,
  childrenMap: ReadonlyMap<PlannerParentPathId, readonly FlattenedPlannerNode[]>,
): Set<PlannerNodePathId> {
  const visibleIds = new Set(visibleItems.map((item) => item.pathId));
  const selectedIds = new Set<PlannerNodePathId>();

  selectionRange.forEach((item) => {
    const children = childrenMap.get(item.pathId) ?? [];
    const hasVisibleChild = children.some((child) => visibleIds.has(child.pathId));

    // 양 끝 노드는 사용자가 직접 지정한 작업 대상이다. 범위 중간의 펼쳐진 부모는
    // 구조를 보여 주는 행일 뿐이므로, 자식이 모두 포함될 때만 아래 단계에서 승격한다.
    if (
      isSelectionEndpoint(item, currentItem, lastSelectedItem) ||
      children.length === 0 ||
      !hasVisibleChild
    ) {
      selectedIds.add(item.pathId);
    }
  });

  return selectedIds;
}

function promoteCompleteBranches(
  visibleItems: readonly FlattenedPlannerNode[],
  selectedIds: Set<PlannerNodePathId>,
  childrenMap: ReadonlyMap<PlannerParentPathId, readonly FlattenedPlannerNode[]>,
): void {
  // 자식부터 검사해야 장소 전체 → Day, Day 전체 → 지역 폴더 승격이 한 번에 이어진다.
  for (let index = visibleItems.length - 1; index >= 0; index -= 1) {
    const parent = visibleItems[index];
    const children = childrenMap.get(parent.pathId) ?? [];

    // 화면에서 숨기는 프로젝트 root까지 하나의 선택으로 합치지는 않는다.
    if (
      parent.parentPathId !== null &&
      children.length > 0 &&
      children.every((child) => selectedIds.has(child.pathId))
    ) {
      selectedIds.add(parent.pathId);
    }
  }
}

function hasSelectedAncestor(
  item: FlattenedPlannerNode,
  selectedIds: ReadonlySet<PlannerNodePathId>,
  entityMap: ReadonlyMap<PlannerNodePathId, FlattenedPlannerNode>,
): boolean {
  let parentPathId = item.parentPathId;

  while (parentPathId) {
    if (selectedIds.has(parentPathId)) {
      return true;
    }

    parentPathId = entityMap.get(parentPathId)?.parentPathId ?? null;
  }

  return false;
}

// 실제 작업 대상은 최소 상위 가지로 정규화하고, 연속 배경에 사용할 원시 범위는
// getShiftSelectionRange로 별도 반환한다. 두 결과를 분리해야 부모와 자손이 중복 강조되지 않는다.
export function calculateShiftSelection({
  flattenedItems,
  currentItem,
  lastSelectedItem,
  childrenMap,
  entityMap,
}: SelectionOptions): FlattenedPlannerNode[] {
  const selectionRange = getShiftSelectionRange(flattenedItems, currentItem, lastSelectedItem);
  const selectedIds = getInitialSelectionIds(
    flattenedItems,
    selectionRange,
    currentItem,
    lastSelectedItem,
    childrenMap,
  );

  promoteCompleteBranches(flattenedItems, selectedIds, childrenMap);

  // 화면 순서를 유지하면서 선택된 조상이 대표하는 모든 중복 자손을 제거한다.
  return flattenedItems.filter(
    (item) => selectedIds.has(item.pathId) && !hasSelectedAncestor(item, selectedIds, entityMap),
  );
}
