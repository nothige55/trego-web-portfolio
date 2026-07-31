import type {
  CreateActivityRequest,
  CreateDayRequest,
  CreateFolderRequest,
  PlannerActivityUpdate,
  PlannerHubEvent,
  PlannerProjectUpdate,
  UpdateActivityRequest,
  UpdateProjectRequest,
} from "@/features/planner/realtime/project-hub-planner-contracts";
import { EMPTY_GUID } from "@/features/planner/realtime/project-hub-planner-contracts";
import type {
  PlannerActivityNode,
  PlannerDayNode,
  PlannerFolderNode,
  PlannerNode,
} from "@/features/planner/types/planner-node";

export function normalizeParentPathId(parentPathId: string | null | undefined): string | null {
  return !parentPathId || parentPathId === EMPTY_GUID ? null : parentPathId;
}

export function toHubParentPathId(parentPathId: string | null): string {
  return parentPathId ?? EMPTY_GUID;
}

export function normalizeFolderCreated(request: CreateFolderRequest): PlannerFolderNode {
  return {
    kind: "folder",
    id: request.id,
    name: request.name,
    folderType: request.type,
    pathId: request.pathId,
    parentPathId: normalizeParentPathId(request.parentPathId),
    position: request.position,
  };
}

export function normalizeDayCreated(request: CreateDayRequest): PlannerDayNode {
  return {
    kind: "day",
    id: request.id,
    name: request.name,
    color: request.color,
    pathId: request.pathId,
    parentPathId: normalizeParentPathId(request.parentPathId),
    position: request.position,
  };
}

export function normalizeActivityCreated(request: CreateActivityRequest): PlannerActivityNode {
  return {
    kind: "activity",
    id: request.id,
    name: request.name,
    activityType: request.type,
    memo: null,
    markerType: request.marker,
    travelMode: request.travelMode,
    travelTime: request.travelTimeMinutes,
    travelDistance: request.travelDistanceMeters,
    travelCost: request.travelCost,
    startTime: null,
    endTime: null,
    placeId: null,
    latitude: request.lat,
    longitude: request.lng,
    googlePlaceId: request.googleId,
    pathId: request.pathId,
    parentPathId: normalizeParentPathId(request.parentPathId),
    position: request.position,
  };
}

export function normalizeActivityUpdated(request: UpdateActivityRequest): PlannerActivityUpdate {
  return {
    id: request.id,
    ...(request.name !== null && request.name !== undefined ? { name: request.name } : {}),
    ...(request.memo !== undefined ? { memo: request.memo } : {}),
    ...(request.startTime !== undefined ? { startTime: request.startTime } : {}),
    ...(request.endTime !== undefined ? { endTime: request.endTime } : {}),
    ...(request.marker !== undefined ? { markerType: request.marker } : {}),
    ...(request.travelMode !== undefined ? { travelMode: request.travelMode } : {}),
    ...(request.travelTimeMinuates !== undefined ? { travelTime: request.travelTimeMinuates } : {}),
    ...(request.travelDistanceMeters !== undefined
      ? { travelDistance: request.travelDistanceMeters }
      : {}),
    ...(request.travelCost !== undefined ? { travelCost: request.travelCost } : {}),
  };
}

export function normalizeProjectUpdated(request: UpdateProjectRequest): PlannerProjectUpdate {
  return { ...request };
}

function isShallowEqual(left: PlannerNode, right: PlannerNode): boolean {
  const keys = Object.keys(left) as (keyof PlannerNode)[];
  return keys.length === Object.keys(right).length && keys.every((key) => left[key] === right[key]);
}

function upsertNode(nodes: readonly PlannerNode[], nextNode: PlannerNode): readonly PlannerNode[] {
  const existingIndex = nodes.findIndex((node) => node.pathId === nextNode.pathId);

  if (existingIndex === -1) {
    return [...nodes, nextNode];
  }

  const existingNode = nodes[existingIndex];
  if (isShallowEqual(existingNode, nextNode)) {
    return nodes;
  }

  return nodes.map((node, index) => (index === existingIndex ? nextNode : node));
}

function updateMatchingNode(
  nodes: readonly PlannerNode[],
  predicate: (node: PlannerNode) => boolean,
  update: (node: PlannerNode) => PlannerNode,
): readonly PlannerNode[] {
  let changed = false;
  const nextNodes = nodes.map((node) => {
    if (!predicate(node)) {
      return node;
    }

    const nextNode = update(node);
    if (isShallowEqual(node, nextNode)) {
      return node;
    }

    changed = true;
    return nextNode;
  });

  return changed ? nextNodes : nodes;
}

function deleteNodeTree(nodes: readonly PlannerNode[], pathId: string): readonly PlannerNode[] {
  if (!nodes.some((node) => node.pathId === pathId)) {
    return nodes;
  }

  const deletedPathIds = new Set([pathId]);
  let foundChild = true;

  while (foundChild) {
    foundChild = false;
    nodes.forEach((node) => {
      if (
        node.parentPathId &&
        deletedPathIds.has(node.parentPathId) &&
        !deletedPathIds.has(node.pathId)
      ) {
        deletedPathIds.add(node.pathId);
        foundChild = true;
      }
    });
  }

  return nodes.filter((node) => !deletedPathIds.has(node.pathId));
}

export function reducePlannerHubEvent(
  nodes: readonly PlannerNode[],
  event: PlannerHubEvent,
): readonly PlannerNode[] {
  switch (event.name) {
    case "OnFolderCreated":
      return upsertNode(nodes, normalizeFolderCreated(event.payload));
    case "OnDayCreated":
      return upsertNode(nodes, normalizeDayCreated(event.payload));
    case "OnActivityCreated":
      return upsertNode(nodes, normalizeActivityCreated(event.payload));
    case "OnPathUpdated":
      return updateMatchingNode(
        nodes,
        (node) => node.pathId === event.payload.pathId,
        (node) => ({
          ...node,
          parentPathId: normalizeParentPathId(event.payload.parentPathId),
          position: event.payload.position,
        }),
      );
    case "OnFolderUpdated":
      return updateMatchingNode(
        nodes,
        (node) => node.kind === "folder" && node.id === event.payload.id,
        (node) => ({
          ...node,
          name: event.payload.name,
          folderType: event.payload.type,
        }),
      );
    case "OnDayUpdated":
      return updateMatchingNode(
        nodes,
        (node) => node.kind === "day" && node.id === event.payload.id,
        (node) => ({ ...node, name: event.payload.name, color: event.payload.color }),
      );
    case "OnActivityUpdated": {
      const update = normalizeActivityUpdated(event.payload);
      const { id, ...changes } = update;
      return updateMatchingNode(
        nodes,
        (node) => node.kind === "activity" && node.id === id,
        (node) => ({ ...node, ...changes }),
      );
    }
    case "OnNodeDeleted":
      return deleteNodeTree(nodes, event.payload.pathId);
    case "OnProjectDateUpdated":
      return nodes;
    default:
      return nodes;
  }
}
