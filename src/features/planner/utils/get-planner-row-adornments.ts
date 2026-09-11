// 행 자체의 상태가 아니라 이웃 관계에서 나오는 표시 요소를 계산
// 렌더 루프 안에 두면 트리 탐색과 JSX가 섞이므로 순수 함수로 분리

import type {
  FlattenedPlannerNode,
  PlannerActivityNode,
  PlannerNodePathId,
  PlannerTree,
} from "@/features/planner/types/planner-node";
import type { PlannerDragProjection } from "@/features/planner/utils/build-planner-drag-projection";
import { calculatePlannerDistanceKm } from "@/features/planner/utils/calculate-planner-distance";

export type PlannerRowAdornments = {
  // 스크롤 경계에서 다음 최상위 노드로 넘어가기 직전에 겹쳐 보여 줄 조상 행
  readonly boundaryAncestor?: FlattenedPlannerNode;
  // 같은 Day 안에서 바로 앞 Activity. 이동 수단·거리 안내를 그릴 때만 씀
  readonly previousActivity?: PlannerActivityNode;
  // 경로 정보가 자리를 차지하는 행인지 여부. 트리로만 정하므로 드래그 내내 변하지 않음
  // 드래그 도중 자리가 생기거나 사라지면 행 높이가 달라져 dnd-kit의 이동량과 어긋남
  readonly hasRouteSlot: boolean;
  // 지금(드래그 중이면 투영 기준) 경로 정보가 실제로 그려지는지 여부. 좌표가 없으면 그리지 않음
  readonly showsRouteInfo: boolean;
};

// 평상시에 경로 정보가 실제로 그려지는 행인지 여부. 좌표가 없어 거리를 못 내면 그리지 않으므로
// 자리도 잡지 않음. 트리만 보므로 드래그 내내 같은 답이 나옴
function hasTreeRouteInfo(node: FlattenedPlannerNode, tree: PlannerTree): boolean {
  if (node.kind !== "activity" || node.activityType === "group") {
    return false;
  }

  const parent = node.parentPathId ? tree.entityMap.get(node.parentPathId) : undefined;
  if (parent?.kind !== "day") {
    return false;
  }

  const siblings = tree.childrenMap.get(node.parentPathId) ?? [];
  const index = siblings.findIndex((sibling) => sibling.pathId === node.pathId);
  const previous = index > 0 ? siblings[index - 1] : undefined;
  if (previous?.kind !== "activity" || previous.activityType === "group") {
    return false;
  }

  return calculatePlannerDistanceKm(previous, node) !== null;
}

function getTopAncestor(
  node: FlattenedPlannerNode,
  tree: PlannerTree,
  rootPathId: PlannerNodePathId | null,
): FlattenedPlannerNode {
  let currentItem = node;

  while (currentItem.parentPathId) {
    const parent = tree.entityMap.get(currentItem.parentPathId);
    if (!parent || parent.pathId === rootPathId) {
      break;
    }
    currentItem = parent;
  }

  return currentItem;
}

export function getPlannerRowAdornments({
  node,
  nextNode,
  tree,
  rootPathId,
  topItemId,
  isDragging,
  projection,
}: {
  readonly node: FlattenedPlannerNode;
  readonly nextNode?: FlattenedPlannerNode;
  readonly tree: PlannerTree;
  readonly rootPathId: PlannerNodePathId | null;
  readonly topItemId: PlannerNodePathId | null;
  readonly isDragging: boolean;
  // 드래그 중이면 지금 놓았을 때의 이웃 관계로 앞 Activity를 고름
  readonly projection?: PlannerDragProjection | null;
}): PlannerRowAdornments {
  // 잡은 노드는 목적지의 자식으로 옮겨 계산. node.parentPathId는 아직 옛 부모
  const parentPathId =
    projection && node.pathId === projection.activePathId
      ? projection.parentPathId
      : node.parentPathId;
  const parent = parentPathId ? tree.entityMap.get(parentPathId) : undefined;
  const siblings = (projection?.childrenMap ?? tree.childrenMap).get(parentPathId) ?? [];
  const siblingIndex = siblings.findIndex((sibling) => sibling.pathId === node.pathId);
  const previousSibling = siblingIndex > 0 ? siblings[siblingIndex - 1] : undefined;
  const previousActivity =
    node.kind === "activity" &&
    node.activityType !== "group" &&
    parent?.kind === "day" &&
    previousSibling?.kind === "activity" &&
    previousSibling.activityType !== "group"
      ? previousSibling
      : undefined;
  const hasRouteSlot = hasTreeRouteInfo(node, tree);
  const showsRouteInfo =
    previousActivity !== undefined &&
    node.kind === "activity" &&
    calculatePlannerDistanceKm(previousActivity, node) !== null;

  // 형제가 하나뿐인 root 직속 자식은 조상을 겹쳐 봐도 얻는 정보가 없음
  const isAloneAndRootChild =
    (tree.childrenMap.get(node.parentPathId) ?? []).length === 1 && node.depth === 2;
  const boundaryAncestor =
    !isDragging &&
    nextNode?.depth === 1 &&
    node.pathId === topItemId &&
    node.depth !== 1 &&
    !isAloneAndRootChild
      ? getTopAncestor(node, tree, rootPathId)
      : undefined;

  return { boundaryAncestor, hasRouteSlot, previousActivity, showsRouteInfo };
}
