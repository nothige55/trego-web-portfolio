import type {
  FlattenedPlannerNode,
  PlannerNode,
  PlannerNodePathId,
  PlannerTree,
} from "@/features/planner/types/planner-node";

const POSITION_STEP = 0.1;

export interface PlannerDropRequest {
  readonly rootPathId: PlannerNodePathId;
  readonly activePathId: PlannerNodePathId;
  readonly parentPathId: PlannerNodePathId;
  /** The index in the destination siblings after the active node has been removed. */
  readonly siblingIndex: number;
}

export interface PlannerDropDestination {
  readonly parentPathId: PlannerNodePathId;
  readonly siblingIndex: number;
  readonly position: number;
}

export type PlannerDropRejectionReason =
  | "root-not-found"
  | "root-node"
  | "active-not-found"
  | "parent-not-found"
  | "outside-root"
  | "root-activity"
  | "invalid-child-kind"
  | "cycle"
  | "invalid-sibling-index"
  | "unchanged"
  | "position-unavailable";

export type PlannerDropResult =
  | Readonly<{
      accepted: true;
      destination: Readonly<PlannerDropDestination>;
    }>
  | Readonly<{
      accepted: false;
      reason: PlannerDropRejectionReason;
    }>;

export function isPlannerChildAllowed(parent: PlannerNode, child: PlannerNode): boolean {
  if (parent.kind === "folder") {
    if (parent.folderType === "default") {
      return child.kind === "folder" || child.kind === "day";
    }

    if (parent.folderType === "wish") {
      return child.kind === "activity";
    }

    return false;
  }

  if (parent.kind === "day") {
    return child.kind === "activity";
  }

  return (
    parent.activityType === "group" && child.kind === "activity" && child.activityType === "single"
  );
}

function createsCycle(
  activePathId: PlannerNodePathId,
  parentPathId: PlannerNodePathId,
  entityMap: ReadonlyMap<PlannerNodePathId, FlattenedPlannerNode>,
): boolean {
  const visitedPathIds = new Set<PlannerNodePathId>();
  let currentPathId: PlannerNodePathId | null = parentPathId;

  while (currentPathId !== null) {
    if (currentPathId === activePathId || visitedPathIds.has(currentPathId)) {
      return true;
    }

    visitedPathIds.add(currentPathId);
    currentPathId = entityMap.get(currentPathId)?.parentPathId ?? null;
  }

  return false;
}

function isWithinRoot(
  pathId: PlannerNodePathId,
  rootPathId: PlannerNodePathId,
  entityMap: ReadonlyMap<PlannerNodePathId, FlattenedPlannerNode>,
): boolean {
  const visitedPathIds = new Set<PlannerNodePathId>();
  let currentPathId: PlannerNodePathId | null = pathId;

  while (currentPathId !== null && !visitedPathIds.has(currentPathId)) {
    if (currentPathId === rootPathId) {
      return true;
    }

    visitedPathIds.add(currentPathId);
    currentPathId = entityMap.get(currentPathId)?.parentPathId ?? null;
  }

  return false;
}

function calculatePosition(
  previousSibling: FlattenedPlannerNode | undefined,
  nextSibling: FlattenedPlannerNode | undefined,
): number | null {
  if (!previousSibling && !nextSibling) {
    return POSITION_STEP;
  }

  if (!previousSibling && nextSibling) {
    const midpointPosition = nextSibling.position / 2;
    if (Number.isFinite(midpointPosition) && midpointPosition < nextSibling.position) {
      return midpointPosition;
    }

    const precedingPosition = nextSibling.position - POSITION_STEP;
    return Number.isFinite(precedingPosition) && precedingPosition < nextSibling.position
      ? precedingPosition
      : null;
  }

  if (previousSibling && !nextSibling) {
    const position = previousSibling.position + POSITION_STEP;
    return Number.isFinite(position) && position > previousSibling.position ? position : null;
  }

  if (!previousSibling || !nextSibling) {
    return null;
  }

  const position = (previousSibling.position + nextSibling.position) / 2;
  return Number.isFinite(position) &&
    position > previousSibling.position &&
    position < nextSibling.position
    ? position
    : null;
}

function reject(reason: PlannerDropRejectionReason): PlannerDropResult {
  return Object.freeze({ accepted: false, reason });
}

export function calculatePlannerDropDestination(
  tree: PlannerTree,
  request: Readonly<PlannerDropRequest>,
): PlannerDropResult {
  const rootNode = tree.entityMap.get(request.rootPathId);

  if (!rootNode || rootNode.parentPathId !== null) {
    return reject("root-not-found");
  }

  const activeNode = tree.entityMap.get(request.activePathId);

  if (!activeNode) {
    return reject("active-not-found");
  }

  if (activeNode.pathId === rootNode.pathId) {
    return reject("root-node");
  }

  const parentNode = tree.entityMap.get(request.parentPathId);

  if (!parentNode) {
    return reject("parent-not-found");
  }

  if (createsCycle(activeNode.pathId, request.parentPathId, tree.entityMap)) {
    return reject("cycle");
  }

  if (!isWithinRoot(parentNode.pathId, rootNode.pathId, tree.entityMap)) {
    return reject("outside-root");
  }

  if (parentNode.pathId === rootNode.pathId && activeNode.kind === "activity") {
    return reject("root-activity");
  }

  if (parentNode.pathId !== rootNode.pathId && !isPlannerChildAllowed(parentNode, activeNode)) {
    return reject("invalid-child-kind");
  }

  const destinationSiblings = (tree.childrenMap.get(request.parentPathId) ?? []).filter(
    (node) => node.pathId !== activeNode.pathId,
  );

  if (
    !Number.isInteger(request.siblingIndex) ||
    request.siblingIndex < 0 ||
    request.siblingIndex > destinationSiblings.length
  ) {
    return reject("invalid-sibling-index");
  }

  const currentSiblingIndex = (tree.childrenMap.get(activeNode.parentPathId) ?? []).findIndex(
    (node) => node.pathId === activeNode.pathId,
  );

  if (
    activeNode.parentPathId === request.parentPathId &&
    currentSiblingIndex === request.siblingIndex
  ) {
    return reject("unchanged");
  }

  const position = calculatePosition(
    destinationSiblings[request.siblingIndex - 1],
    destinationSiblings[request.siblingIndex],
  );

  if (position === null) {
    return reject("position-unavailable");
  }

  const destination = Object.freeze({
    parentPathId: request.parentPathId,
    siblingIndex: request.siblingIndex,
    position,
  });

  return Object.freeze({ accepted: true, destination });
}
