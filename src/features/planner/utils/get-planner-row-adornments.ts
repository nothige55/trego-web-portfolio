import type {
  FlattenedPlannerNode,
  PlannerActivityNode,
  PlannerNodePathId,
  PlannerTree,
} from "@/features/planner/types/planner-node";

export type PlannerRowAdornments = {
  // 스크롤 경계에서 다음 최상위 노드로 넘어가기 직전에 겹쳐 보여 줄 조상 행이다.
  readonly boundaryAncestor?: FlattenedPlannerNode;
  // 같은 Day 안에서 바로 앞 Activity다. 이동 수단·거리 안내를 그릴 때만 쓴다.
  readonly previousActivity?: PlannerActivityNode;
};

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

// 행 자체의 상태가 아니라 이웃 관계에서 나오는 표시 요소를 계산한다.
// 렌더 루프 안에 두면 트리 탐색과 JSX가 섞이므로 순수 함수로 분리한다.
export function getPlannerRowAdornments({
  node,
  nextNode,
  tree,
  rootPathId,
  topItemId,
  isDragging,
}: {
  readonly node: FlattenedPlannerNode;
  readonly nextNode?: FlattenedPlannerNode;
  readonly tree: PlannerTree;
  readonly rootPathId: PlannerNodePathId | null;
  readonly topItemId: PlannerNodePathId | null;
  readonly isDragging: boolean;
}): PlannerRowAdornments {
  const parent = node.parentPathId ? tree.entityMap.get(node.parentPathId) : undefined;
  const siblings = tree.childrenMap.get(node.parentPathId) ?? [];
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

  // 형제가 하나뿐인 root 직속 자식은 조상을 겹쳐 봐도 얻는 정보가 없다.
  const isAloneAndRootChild = siblings.length === 1 && node.depth === 2;
  const boundaryAncestor =
    !isDragging &&
    nextNode?.depth === 1 &&
    node.pathId === topItemId &&
    node.depth !== 1 &&
    !isAloneAndRootChild
      ? getTopAncestor(node, tree, rootPathId)
      : undefined;

  return { boundaryAncestor, previousActivity };
}
