import type {
  CreateActivityInput,
  CreateDayInput,
  CreateFolderInput,
  UpdatePathInput,
} from "@/features/planner/realtime/project-hub-planner-contracts";
import type { PlannerNode, PlannerNodePathId } from "@/features/planner/types/planner-node";

const POSITION_STEP = 0.1;

export type PlannerCreateNodeKind = "day" | "wish-folder";

export interface PlannerCreateNodeDraft {
  readonly kind: PlannerCreateNodeKind;
  readonly name: string;
  readonly parentPathId: PlannerNodePathId;
}

export type PlannerCreateNodeInput =
  | Readonly<{ kind: "day"; input: CreateDayInput }>
  | Readonly<{ kind: "wish-folder"; input: CreateFolderInput }>;

export interface PlannerGroupPlan {
  readonly container:
    | Readonly<{ kind: "activity"; input: CreateActivityInput }>
    | Readonly<{ kind: "folder"; input: CreateFolderInput }>;
  readonly moves: readonly UpdatePathInput[];
}

function createId(): string {
  return globalThis.crypto.randomUUID();
}

export function getAppendPosition(
  nodes: readonly PlannerNode[],
  parentPathId: PlannerNodePathId,
): number {
  const lastPosition = nodes
    .filter((node) => node.parentPathId === parentPathId)
    .reduce((maximum, node) => Math.max(maximum, node.position), 0);

  return lastPosition + POSITION_STEP;
}

function createActivityInput(
  nodes: readonly PlannerNode[],
  parentPathId: PlannerNodePathId,
  name: string,
  activityType: "group" | "single",
): CreateActivityInput {
  return {
    id: createId(),
    name,
    pathId: createId(),
    parentPathId,
    position: getAppendPosition(nodes, parentPathId),
    activityType,
    markerType: null,
    travelMode: null,
    travelTime: 0,
    travelDistance: 0,
    travelCost: "",
    latitude: 0,
    longitude: 0,
    rating: 0,
    ratingCount: 0,
    googlePlaceId: "",
  };
}

export function buildCreateNodeInput(
  nodes: readonly PlannerNode[],
  draft: PlannerCreateNodeDraft,
): PlannerCreateNodeInput {
  const name = draft.name.trim();

  if (!name) {
    throw new Error("이름을 입력해 주세요.");
  }

  if (draft.kind === "day") {
    return {
      kind: "day",
      input: {
        id: createId(),
        name,
        pathId: createId(),
        parentPathId: draft.parentPathId,
        position: getAppendPosition(nodes, draft.parentPathId),
        color: "#F44336",
      },
    };
  }

  return {
    kind: "wish-folder",
    input: {
      id: createId(),
      name,
      pathId: createId(),
      parentPathId: draft.parentPathId,
      position: getAppendPosition(nodes, draft.parentPathId),
      folderType: "wish",
    },
  };
}

function hasSelectedAncestor(
  node: PlannerNode,
  selectedPathIds: ReadonlySet<PlannerNodePathId>,
  nodeByPathId: ReadonlyMap<PlannerNodePathId, PlannerNode>,
): boolean {
  let parentPathId = node.parentPathId;

  while (parentPathId) {
    if (selectedPathIds.has(parentPathId)) {
      return true;
    }
    parentPathId = nodeByPathId.get(parentPathId)?.parentPathId ?? null;
  }

  return false;
}

export function normalizeOperationPathIds(
  nodes: readonly PlannerNode[],
  pathIds: readonly PlannerNodePathId[],
): PlannerNodePathId[] {
  const selectedPathIds = new Set(pathIds);
  const nodeByPathId = new Map(nodes.map((node) => [node.pathId, node]));

  return nodes
    .filter(
      (node) =>
        selectedPathIds.has(node.pathId) &&
        !hasSelectedAncestor(node, selectedPathIds, nodeByPathId),
    )
    .sort((left, right) => left.position - right.position)
    .map((node) => node.pathId);
}

export function buildGroupPlan(
  nodes: readonly PlannerNode[],
  pathIds: readonly PlannerNodePathId[],
  name = "새 그룹",
): PlannerGroupPlan {
  const normalizedPathIds = normalizeOperationPathIds(nodes, pathIds);
  const selectedNodes = normalizedPathIds
    .map((pathId) => nodes.find((node) => node.pathId === pathId))
    .filter((node): node is PlannerNode => Boolean(node));

  if (selectedNodes.length < 2) {
    throw new Error("두 개 이상의 일정을 선택해 주세요.");
  }

  const parentPathId = selectedNodes[0]?.parentPathId;
  if (!parentPathId || selectedNodes.some((node) => node.parentPathId !== parentPathId)) {
    throw new Error("같은 상위 일정에 있는 항목만 그룹으로 묶을 수 있습니다.");
  }

  const parent = nodes.find((node) => node.pathId === parentPathId);
  const allActivities = selectedNodes.every((node) => node.kind === "activity");
  const canCreateActivityGroup =
    allActivities &&
    (parent?.kind === "day" || (parent?.kind === "folder" && parent.folderType === "wish"));

  const firstPosition = Math.min(...selectedNodes.map((node) => node.position));
  const container = canCreateActivityGroup
    ? ({
        kind: "activity",
        input: {
          ...createActivityInput(nodes, parentPathId, name, "group"),
          position: firstPosition,
        },
      } as const)
    : ({
        kind: "folder",
        input: {
          id: createId(),
          name,
          pathId: createId(),
          parentPathId,
          position: firstPosition,
          folderType: "default",
        },
      } as const);

  if (!canCreateActivityGroup && !selectedNodes.every((node) => node.kind !== "activity")) {
    throw new Error("현재 선택 조합은 하나의 그룹으로 묶을 수 없습니다.");
  }

  return {
    container,
    moves: selectedNodes.map((node, index) => ({
      pathId: node.pathId,
      parentPathId: container.input.pathId,
      position: POSITION_STEP * (index + 1),
    })),
  };
}
