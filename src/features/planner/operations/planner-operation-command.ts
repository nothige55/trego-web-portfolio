import type { PlannerRealtimeCommands } from "@/features/planner/realtime/planner-realtime";
import type {
  CreateActivityInput,
  CreateDayInput,
  CreateFolderInput,
  DeleteNodeInput,
  UpdateActivityInput,
  UpdateDayInput,
  UpdateFolderInput,
  UpdatePathInput,
} from "@/features/planner/realtime/project-hub-planner-contracts";
import type { PlannerNode, PlannerNodePathId } from "@/features/planner/types/planner-node";

export type PlannerOperationCommand =
  | Readonly<{ type: "create-activity"; input: CreateActivityInput }>
  | Readonly<{ type: "create-day"; input: CreateDayInput }>
  | Readonly<{ type: "create-folder"; input: CreateFolderInput }>
  | Readonly<{ type: "delete-node"; input: DeleteNodeInput }>
  | Readonly<{ type: "update-activity"; input: UpdateActivityInput }>
  | Readonly<{ type: "update-day"; input: UpdateDayInput }>
  | Readonly<{ type: "update-folder"; input: UpdateFolderInput }>
  | Readonly<{ type: "update-path"; input: UpdatePathInput }>;

export async function executePlannerOperationCommands(
  commands: PlannerRealtimeCommands,
  operations: readonly PlannerOperationCommand[],
): Promise<void> {
  for (const operation of operations) {
    switch (operation.type) {
      case "create-activity":
        await commands.createActivity(operation.input);
        break;
      case "create-day":
        await commands.createDay(operation.input);
        break;
      case "create-folder":
        await commands.createFolder(operation.input);
        break;
      case "delete-node":
        await commands.deleteNode(operation.input);
        break;
      case "update-activity":
        await commands.updateActivity(operation.input);
        break;
      case "update-day":
        await commands.updateDay(operation.input);
        break;
      case "update-folder":
        await commands.updateFolder(operation.input);
        break;
      case "update-path":
        await commands.updatePath(operation.input);
        break;
      default: {
        const exhaustiveCheck: never = operation;
        throw new Error(`지원하지 않는 Planner 작업입니다: ${String(exhaustiveCheck)}`);
      }
    }
  }
}

export function createNodeOperation(node: PlannerNode): PlannerOperationCommand[] {
  if (node.kind === "folder") {
    return [
      {
        type: "create-folder",
        input: {
          id: node.id,
          name: node.name,
          pathId: node.pathId,
          parentPathId: node.parentPathId,
          position: node.position,
          folderType: node.folderType ?? "default",
        },
      },
    ];
  }

  if (node.kind === "day") {
    return [
      {
        type: "create-day",
        input: {
          id: node.id,
          name: node.name,
          pathId: node.pathId,
          parentPathId: node.parentPathId,
          position: node.position,
          color: node.color ?? "#F44336",
        },
      },
    ];
  }

  const create: PlannerOperationCommand = {
    type: "create-activity",
    input: {
      id: node.id,
      name: node.name,
      pathId: node.pathId,
      parentPathId: node.parentPathId,
      position: node.position,
      activityType: node.activityType ?? "single",
      markerType: node.markerType,
      travelMode: node.travelMode,
      travelTime: node.travelTime ?? 0,
      travelDistance: node.travelDistance ?? 0,
      travelCost: node.travelCost ?? "",
      latitude: node.latitude ?? 0,
      longitude: node.longitude ?? 0,
      rating: 0,
      ratingCount: 0,
      googlePlaceId: node.googlePlaceId ?? "",
    },
  };
  const hasEditableDetails = Boolean(node.memo || node.startTime || node.endTime);

  return hasEditableDetails
    ? [
        create,
        {
          type: "update-activity",
          input: {
            id: node.id,
            name: node.name,
            memo: node.memo,
            startTime: node.startTime,
            endTime: node.endTime,
            markerType: node.markerType,
            travelMode: node.travelMode,
            travelTime: node.travelTime,
            travelDistance: node.travelDistance,
            travelCost: node.travelCost,
          },
        },
      ]
    : [create];
}

function collectSubtreePathIds(
  nodes: readonly PlannerNode[],
  rootPathIds: readonly PlannerNodePathId[],
): Set<PlannerNodePathId> {
  const pathIds = new Set(rootPathIds);
  let changed = true;

  while (changed) {
    changed = false;
    nodes.forEach((node) => {
      if (node.parentPathId && pathIds.has(node.parentPathId) && !pathIds.has(node.pathId)) {
        pathIds.add(node.pathId);
        changed = true;
      }
    });
  }

  return pathIds;
}

function nodeDepth(node: PlannerNode, nodeByPathId: ReadonlyMap<string, PlannerNode>): number {
  let depth = 0;
  let parentPathId = node.parentPathId;

  while (parentPathId) {
    depth += 1;
    parentPathId = nodeByPathId.get(parentPathId)?.parentPathId ?? null;
  }

  return depth;
}

export function buildDeleteHistoryOperations(
  nodes: readonly PlannerNode[],
  rootPathIds: readonly PlannerNodePathId[],
): Readonly<{
  redo: readonly PlannerOperationCommand[];
  undo: readonly PlannerOperationCommand[];
}> {
  const deletedPathIds = collectSubtreePathIds(nodes, rootPathIds);
  const nodeByPathId = new Map(nodes.map((node) => [node.pathId, node]));
  const deletedNodes = nodes
    .filter((node) => deletedPathIds.has(node.pathId))
    .sort((left, right) => nodeDepth(left, nodeByPathId) - nodeDepth(right, nodeByPathId));

  return {
    redo: rootPathIds.map((pathId) => ({ type: "delete-node", input: { pathId } })),
    undo: deletedNodes.flatMap(createNodeOperation),
  };
}
