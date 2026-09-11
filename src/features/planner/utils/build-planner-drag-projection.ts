// 드래그 중 목적지를 반영한 형제 관계(투영)를 만듦. 경로 정보 판정(get-planner-row-adornments)과
// 행 배치(build-planner-drag-layout)가 같은 투영을 읽어야 둘이 어긋나지 않음

import type {
  FlattenedPlannerNode,
  PlannerNodePathId,
  PlannerParentPathId,
  PlannerTree,
} from "@/features/planner/types/planner-node";

// 드롭 목적지 중 이웃 관계 계산에 필요한 부분만 받음
export interface PlannerDragDestination {
  readonly parentPathId: PlannerNodePathId;
  /** 잡은 노드를 뺀 뒤의 형제 목록 기준 index */
  readonly siblingIndex: number;
}

export interface PlannerDragProjection {
  readonly childrenMap: ReadonlyMap<PlannerParentPathId, readonly FlattenedPlannerNode[]>;
  readonly activePathId: PlannerNodePathId;
  /** 잡은 노드가 놓일 부모. 목적지가 없으면 목록에서 빠진 상태라 null */
  readonly parentPathId: PlannerParentPathId;
}

// 드래그 중에는 트리가 아직 바뀌지 않지만, 경로 정보는 두 장소 사이의 구간이라
// 지금 놓으면 생길 이웃 관계를 보여 줘야 함. 잡은 노드를 원래 자리에서 빼고
// 목적지에 끼운 형제 목록을 만들어 그 계산에만 씀. 트리 자체는 건드리지 않음
export function buildPlannerDragProjection({
  tree,
  activePathId,
  destination,
}: {
  readonly tree: PlannerTree;
  readonly activePathId: PlannerNodePathId | null;
  readonly destination: PlannerDragDestination | null;
}): PlannerDragProjection | null {
  if (!activePathId) {
    return null;
  }

  const activeNode = tree.entityMap.get(activePathId);
  if (!activeNode) {
    return null;
  }

  const childrenMap = new Map(tree.childrenMap);
  const origin = childrenMap.get(activeNode.parentPathId) ?? [];
  childrenMap.set(
    activeNode.parentPathId,
    origin.filter((sibling) => sibling.pathId !== activePathId),
  );

  if (!destination) {
    return { activePathId, childrenMap, parentPathId: null };
  }

  const siblings = [...(childrenMap.get(destination.parentPathId) ?? [])];
  // 목적지 index는 규칙 계산이 이미 검증했지만, 드래그 중 상태라 트리와 어긋날 수 있음
  const insertIndex = Math.min(Math.max(destination.siblingIndex, 0), siblings.length);
  siblings.splice(insertIndex, 0, activeNode);
  childrenMap.set(destination.parentPathId, siblings);

  return { activePathId, childrenMap, parentPathId: destination.parentPathId };
}
