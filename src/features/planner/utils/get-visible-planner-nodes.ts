import type {
  FlattenedPlannerNode,
  PlannerNodePathId,
  PlannerParentPathId,
} from "@/features/planner/types/planner-node";

// depth-first로 정렬된 전체 목록에서 접힌 가지의 자손을 제거한다.
// 원본 배열과 expandedIds는 변경하지 않아 React selector와 테스트에서 안전하게 재사용할 수 있다.
export function getVisiblePlannerNodes(
  flattenedItems: readonly FlattenedPlannerNode[],
  expandedIds: ReadonlySet<PlannerNodePathId>,
  childrenMap: ReadonlyMap<PlannerParentPathId, readonly FlattenedPlannerNode[]>,
): FlattenedPlannerNode[] {
  const collapsedAncestorIds = new Set<PlannerNodePathId>();

  return flattenedItems.reduce<FlattenedPlannerNode[]>((visibleItems, item) => {
    if (item.parentPathId && collapsedAncestorIds.has(item.parentPathId)) {
      // 숨겨진 자식도 collapsed 집합에 넣어 더 깊은 후손까지 연쇄적으로 숨긴다.
      collapsedAncestorIds.add(item.pathId);
      return visibleItems;
    }

    visibleItems.push(item);

    const hasChildren = (childrenMap.get(item.pathId) ?? []).length > 0;
    if (hasChildren && !expandedIds.has(item.pathId)) {
      collapsedAncestorIds.add(item.pathId);
    }

    return visibleItems;
  }, []);
}
