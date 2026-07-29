import type {
  FlattenedPlannerNode,
  PlannerNode,
  PlannerNodePathId,
  PlannerParentPathId,
  PlannerTree,
} from "@/features/planner/types/planner-node";

const WISH_FOLDER_TYPE = "wish";

type HierarchicalPlannerNode = PlannerNode & {
  readonly depth: number;
  readonly color: string | null;
};

// 원본 배열의 순서를 건드리지 않고 position 기준의 새 배열을 만든다.
function sortByPosition<T extends Pick<PlannerNode, "position">>(items: readonly T[]): T[] {
  return [...items].sort((first, second) => first.position - second.position);
}

// pathId로 부모 노드를 빠르게 찾고 orphan 여부를 판단하기 위한 인덱스다.
function createEntityMap(nodes: readonly PlannerNode[]): Map<PlannerNodePathId, PlannerNode> {
  return new Map(nodes.map((node) => [node.pathId, node]));
}

// 입력 순서와 무관하게 모든 부모-자식 관계를 먼저 모은 뒤 형제 순서를 정렬한다.
function createChildrenMap(nodes: readonly PlannerNode[]): Map<PlannerParentPathId, PlannerNode[]> {
  const childrenMap = new Map<PlannerParentPathId, PlannerNode[]>();

  for (const node of nodes) {
    const siblings = childrenMap.get(node.parentPathId);
    if (siblings) {
      siblings.push(node);
    } else {
      childrenMap.set(node.parentPathId, [node]);
    }
  }

  for (const [parentPathId, children] of childrenMap) {
    childrenMap.set(parentPathId, sortByPosition(children));
  }

  return childrenMap;
}

function flattenHierarchy(
  nodes: readonly PlannerNode[],
  entityMap: ReadonlyMap<PlannerNodePathId, PlannerNode>,
  childrenMap: ReadonlyMap<PlannerParentPathId, readonly PlannerNode[]>,
): HierarchicalPlannerNode[] {
  const flattenedItems: HierarchicalPlannerNode[] = [];

  // 화면 트리 순서와 같은 depth-first 방식으로 현재 노드와 자손을 평탄화한다.
  function visit(node: PlannerNode, depth: number, parentColor: string | null): void {
    // 기존 Planner와 같이 자신의 색상이 없으면 가장 가까운 부모 색상을 상속한다.
    const color = node.color || parentColor;
    const flattenedNode: HierarchicalPlannerNode = {
      ...node,
      color,
      depth,
    };

    flattenedItems.push(flattenedNode);

    const children = childrenMap.get(node.pathId) ?? [];
    children.forEach((child) => {
      visit(child, depth + 1, color);
    });
  }

  // 부모가 없거나 부모 pathId가 entityMap에 없는 orphan은 최상위 노드로 취급한다.
  // orphan의 parentPathId 자체는 이후 childrenMap에서도 원래 값으로 유지한다.
  const rootNodes = sortByPosition(
    nodes.filter((node) => node.parentPathId === null || !entityMap.has(node.parentPathId)),
  );

  rootNodes.forEach((node) => {
    visit(node, 0, node.color ?? null);
  });

  return flattenedItems;
}

function filterEmptyFolders(
  flattenedItems: readonly HierarchicalPlannerNode[],
): HierarchicalPlannerNode[] {
  // 필터링 전 트리를 기준으로 자식이 있었는지 계산한다.
  // 따라서 빈 자식 폴더가 제거된 뒤 부모까지 연쇄 제거하지 않는 기존 단일-pass 규칙을 유지한다.
  const parentPathIds = new Set(
    flattenedItems.map((node) => node.parentPathId).filter((pathId) => pathId !== null),
  );

  return flattenedItems.filter(
    (node) =>
      node.kind !== "folder" ||
      // wish 폴더는 사용자가 장소를 담기 전에도 보여야 하므로 비어 있어도 유지한다.
      node.folderType === WISH_FOLDER_TYPE ||
      parentPathIds.has(node.pathId),
  );
}

// 빈 폴더 제거가 끝난 최종 형제 목록을 기준으로 0부터 다시 index를 부여한다.
function addSiblingIndexes(
  flattenedItems: readonly HierarchicalPlannerNode[],
): FlattenedPlannerNode[] {
  const nextIndexByParentPathId = new Map<PlannerParentPathId, number>();

  return flattenedItems.map((node) => {
    const siblingIndex = nextIndexByParentPathId.get(node.parentPathId) ?? 0;
    nextIndexByParentPathId.set(node.parentPathId, siblingIndex + 1);

    return { ...node, siblingIndex };
  });
}

// 빈 폴더가 제거된 flattenedItems만으로 외부에 노출할 맵을 다시 만든다.
// 이 단계 덕분에 세 결과가 모두 같은 노드 집합을 바라본다.
function rebuildMaps(flattenedItems: readonly FlattenedPlannerNode[]): {
  entityMap: Map<PlannerNodePathId, FlattenedPlannerNode>;
  childrenMap: Map<PlannerParentPathId, FlattenedPlannerNode[]>;
} {
  const entityMap = new Map<PlannerNodePathId, FlattenedPlannerNode>();
  const childrenMap = new Map<PlannerParentPathId, FlattenedPlannerNode[]>();

  for (const node of flattenedItems) {
    entityMap.set(node.pathId, node);

    const siblings = childrenMap.get(node.parentPathId);
    if (siblings) {
      siblings.push(node);
    } else {
      childrenMap.set(node.parentPathId, [node]);
    }
  }

  return { entityMap, childrenMap };
}

export function buildPlannerTree(nodes: readonly PlannerNode[]): PlannerTree {
  // 1. 전체 입력을 인덱싱해 부모보다 자식이 먼저 들어온 경우도 연결한다.
  const initialEntityMap = createEntityMap(nodes);
  const initialChildrenMap = createChildrenMap(nodes);

  // 2. 계층 메타데이터를 붙여 평탄화하고 기존 빈 폴더 규칙을 적용한다.
  const filteredItems = filterEmptyFolders(
    flattenHierarchy(nodes, initialEntityMap, initialChildrenMap),
  );

  // 3. 필터링된 결과를 기준으로 형제 index를 확정하고 조회용 맵을 맞춘다.
  const flattenedItems = addSiblingIndexes(filteredItems);
  const { entityMap, childrenMap } = rebuildMaps(flattenedItems);

  return {
    entityMap,
    childrenMap,
    flattenedItems,
  };
}
