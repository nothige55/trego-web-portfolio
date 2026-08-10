import {
  normalizeProjectUpdated,
  reducePlannerHubEvent,
  toHubParentPathId,
} from "@/features/planner/realtime/planner-realtime-reducer";
import type {
  CreateActivityInput,
  CreateActivityRequest,
  CreateDayInput,
  CreateDayRequest,
  CreateFolderInput,
  CreateFolderRequest,
  DeleteNodeInput,
  PlannerHubCommandMap,
  PlannerHubCommandName,
  PlannerHubEventMap,
  PlannerHubEventName,
  PlannerProjectUpdate,
  UpdateActivityInput,
  UpdateActivityRequest,
  UpdateDayInput,
  UpdateFolderInput,
  UpdateFolderRequest,
  UpdatePathInput,
  UpdatePathRequest,
  UpdateProjectInput,
} from "@/features/planner/realtime/project-hub-planner-contracts";
import type { PlannerNode } from "@/features/planner/types/planner-node";

export interface PlannerHubTransport {
  invoke: <TResult = void>(methodName: string, ...args: readonly unknown[]) => Promise<TResult>;
  on: <TArgs extends readonly unknown[]>(
    eventName: string,
    handler: (...args: TArgs) => void,
  ) => () => void;
}

export interface PlannerRealtimeErrorContext<
  TName extends PlannerHubCommandName = PlannerHubCommandName,
> {
  readonly methodName: TName;
  readonly request: PlannerHubCommandMap[TName];
}

export interface PlannerRealtimeActions {
  readonly getNodes: () => readonly PlannerNode[];
  readonly setNodes: (nodes: readonly PlannerNode[]) => void;
  readonly applyProjectUpdate: (update: PlannerProjectUpdate) => void;
  readonly reportError: (error: unknown, context: PlannerRealtimeErrorContext) => void;
  readonly resync: () => Promise<void>;
}

export interface PlannerRealtimeCommands {
  readonly createFolder: (input: CreateFolderInput) => Promise<void>;
  readonly createDay: (input: CreateDayInput) => Promise<void>;
  readonly createActivity: (input: CreateActivityInput) => Promise<void>;
  readonly updatePath: (input: UpdatePathInput) => Promise<void>;
  readonly updateProject: (input: UpdateProjectInput) => Promise<void>;
  readonly updateFolder: (input: UpdateFolderInput) => Promise<void>;
  readonly updateDay: (input: UpdateDayInput) => Promise<void>;
  readonly updateActivity: (input: UpdateActivityInput) => Promise<void>;
  readonly deleteNode: (input: DeleteNodeInput) => Promise<void>;
}

export interface PlannerRealtimeAdapter {
  readonly commands: PlannerRealtimeCommands;
  readonly subscribe: () => () => void;
}

function createFolderRequest(input: CreateFolderInput): CreateFolderRequest {
  return {
    id: input.id,
    name: input.name,
    type: input.folderType,
    pathId: input.pathId,
    parentPathId: toHubParentPathId(input.parentPathId),
    position: input.position,
  };
}

function createDayRequest(input: CreateDayInput): CreateDayRequest {
  return {
    ...input,
    parentPathId: toHubParentPathId(input.parentPathId),
  };
}

function createActivityRequest(input: CreateActivityInput): CreateActivityRequest {
  return {
    id: input.id,
    name: input.name,
    type: input.activityType,
    marker: input.markerType,
    travelMode: input.travelMode,
    travelTimeMinutes: input.travelTime,
    travelDistanceMeters: input.travelDistance,
    travelCost: input.travelCost,
    lat: input.latitude,
    lng: input.longitude,
    rating: input.rating,
    ratingCount: input.ratingCount,
    googleId: input.googlePlaceId,
    pathId: input.pathId,
    parentPathId: toHubParentPathId(input.parentPathId),
    position: input.position,
  };
}

function createUpdatePathRequest(input: UpdatePathInput): UpdatePathRequest {
  return {
    ...input,
    parentPathId: toHubParentPathId(input.parentPathId),
  };
}

function createUpdateFolderRequest(input: UpdateFolderInput): UpdateFolderRequest {
  return { id: input.id, name: input.name, type: input.folderType };
}

function createUpdateActivityRequest(input: UpdateActivityInput): UpdateActivityRequest {
  const { markerType, travelTime, travelDistance, ...unchangedFields } = input;

  return {
    ...unchangedFields,
    ...(markerType !== undefined ? { marker: markerType } : {}),
    ...(travelTime !== undefined ? { travelTimeMinuates: travelTime } : {}),
    ...(travelDistance !== undefined ? { travelDistanceMeters: travelDistance } : {}),
  };
}

export function createPlannerRealtime(
  client: PlannerHubTransport,
  actions: PlannerRealtimeActions,
): PlannerRealtimeAdapter {
  function applyNodeEvent<TName extends Exclude<PlannerHubEventName, "OnProjectDateUpdated">>(
    name: TName,
    payload: PlannerHubEventMap[TName],
  ): void {
    actions.setNodes(
      reducePlannerHubEvent(actions.getNodes(), {
        name,
        payload,
      } as Parameters<typeof reducePlannerHubEvent>[1]),
    );
  }

  function subscribeNodeEvent<TName extends Exclude<PlannerHubEventName, "OnProjectDateUpdated">>(
    eventName: TName,
  ): () => void {
    return client.on<[PlannerHubEventMap[TName]]>(eventName, (payload) => {
      applyNodeEvent(eventName, payload);
    });
  }

  async function invoke<TName extends PlannerHubCommandName>(
    methodName: TName,
    request: PlannerHubCommandMap[TName],
    applyOptimistic: () => void,
  ): Promise<void> {
    applyOptimistic();

    try {
      await client.invoke(methodName, request);
    } catch (error) {
      actions.reportError(error, { methodName, request });
      await actions.resync();
      throw error;
    }
  }

  const commands: PlannerRealtimeCommands = {
    createFolder(input) {
      const request = createFolderRequest(input);
      return invoke("CreateFolder", request, () => applyNodeEvent("OnFolderCreated", request));
    },
    createDay(input) {
      const request = createDayRequest(input);
      return invoke("CreateDay", request, () => applyNodeEvent("OnDayCreated", request));
    },
    createActivity(input) {
      const request = createActivityRequest(input);
      return invoke("CreateActivity", request, () => applyNodeEvent("OnActivityCreated", request));
    },
    updatePath(input) {
      const request = createUpdatePathRequest(input);
      return invoke("UpdatePath", request, () => applyNodeEvent("OnPathUpdated", request));
    },
    updateProject(input) {
      return invoke("UpdateProject", input, () => {
        actions.applyProjectUpdate(normalizeProjectUpdated(input));
      });
    },
    updateFolder(input) {
      const request = createUpdateFolderRequest(input);
      return invoke("UpdateFolder", request, () => applyNodeEvent("OnFolderUpdated", request));
    },
    updateDay(input) {
      return invoke("UpdateDay", input, () => applyNodeEvent("OnDayUpdated", input));
    },
    updateActivity(input) {
      const request = createUpdateActivityRequest(input);
      return invoke("UpdateActivity", request, () => applyNodeEvent("OnActivityUpdated", request));
    },
    deleteNode(input) {
      return invoke("DeleteNode", input, () => applyNodeEvent("OnNodeDeleted", input));
    },
  };

  return {
    commands,
    subscribe() {
      const unsubscribe = [
        subscribeNodeEvent("OnFolderCreated"),
        subscribeNodeEvent("OnDayCreated"),
        subscribeNodeEvent("OnActivityCreated"),
        subscribeNodeEvent("OnPathUpdated"),
        client.on<[PlannerHubEventMap["OnProjectDateUpdated"]]>("OnProjectDateUpdated", (payload) =>
          actions.applyProjectUpdate(normalizeProjectUpdated(payload)),
        ),
        subscribeNodeEvent("OnFolderUpdated"),
        subscribeNodeEvent("OnDayUpdated"),
        subscribeNodeEvent("OnActivityUpdated"),
        subscribeNodeEvent("OnNodeDeleted"),
      ];

      return () => {
        unsubscribe.forEach((removeListener) => removeListener());
      };
    },
  };
}
