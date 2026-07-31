import type {
  FlattenedPlannerNode,
  PlannerNodePathId,
} from "@/features/planner/types/planner-node";

// 현재 스크롤 상단 노드에서 root 직전까지 올라가 화면에 표시할 경로를 만든다.
export function getPlannerBreadcrumbAncestors(
  topItemId: PlannerNodePathId | null,
  rootPathId: PlannerNodePathId | null,
  entityMap: ReadonlyMap<PlannerNodePathId, FlattenedPlannerNode>,
): FlattenedPlannerNode[] {
  const ancestors: FlattenedPlannerNode[] = [];
  let currentItem = topItemId ? entityMap.get(topItemId) : undefined;

  while (currentItem?.parentPathId) {
    const parent = entityMap.get(currentItem.parentPathId);
    if (!parent || parent.pathId === rootPathId) {
      break;
    }

    ancestors.unshift(parent);
    currentItem = parent;
  }

  return ancestors;
}
