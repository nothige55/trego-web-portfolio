import { describe, expect, it, vi } from "vitest";

import {
  createPlannerRealtime,
  type PlannerHubTransport,
  type PlannerRealtimeActions,
} from "@/features/planner/realtime/planner-realtime";
import type {
  CreateActivityInput,
  CreateFolderInput,
  PlannerHubEventMap,
  PlannerHubEventName,
  PlannerProjectUpdate,
} from "@/features/planner/realtime/project-hub-planner-contracts";
import { EMPTY_GUID } from "@/features/planner/realtime/project-hub-planner-contracts";
import type { PlannerNode } from "@/features/planner/types/planner-node";

interface TestContext {
  readonly adapter: ReturnType<typeof createPlannerRealtime>;
  readonly emit: <TName extends PlannerHubEventName>(
    name: TName,
    payload: PlannerHubEventMap[TName],
  ) => void;
  readonly invoke: ReturnType<typeof vi.fn>;
  readonly on: ReturnType<typeof vi.fn>;
  readonly projectUpdates: PlannerProjectUpdate[];
  readonly reportError: ReturnType<typeof vi.fn>;
  readonly resync: ReturnType<typeof vi.fn>;
  readonly state: { nodes: readonly PlannerNode[] };
}

function setup(invokeImplementation: () => Promise<void> = () => Promise.resolve()): TestContext {
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  const invoke = vi.fn(invokeImplementation);
  const on = vi.fn((eventName: string, handler: (payload: unknown) => void) => {
    const eventListeners = listeners.get(eventName) ?? new Set();
    eventListeners.add(handler);
    listeners.set(eventName, eventListeners);

    return () => eventListeners.delete(handler);
  });
  const state: { nodes: readonly PlannerNode[] } = { nodes: [] };
  const projectUpdates: PlannerProjectUpdate[] = [];
  const reportError = vi.fn();
  const resync = vi.fn(() => Promise.resolve());
  const transport: PlannerHubTransport = {
    invoke: invoke as PlannerHubTransport["invoke"],
    on: on as PlannerHubTransport["on"],
  };
  const actions: PlannerRealtimeActions = {
    getNodes: () => state.nodes,
    setNodes: (nodes) => {
      state.nodes = nodes;
    },
    applyProjectUpdate: (update) => projectUpdates.push(update),
    reportError,
    resync,
  };

  return {
    adapter: createPlannerRealtime(transport, actions),
    emit(name, payload) {
      listeners.get(name)?.forEach((listener) => listener(payload));
    },
    invoke,
    on,
    projectUpdates,
    reportError,
    resync,
    state,
  };
}

const folderInput: CreateFolderInput = {
  id: "folder-id",
  name: "Trip",
  folderType: "default",
  pathId: "folder-path",
  parentPathId: null,
  position: 0,
};

const activityInput: CreateActivityInput = {
  id: "activity-id",
  name: "Museum",
  activityType: "place",
  markerType: "museum",
  travelMode: "walk",
  travelTime: 10,
  travelDistance: 800,
  travelCost: "0",
  latitude: 37.5,
  longitude: 127,
  rating: 4.8,
  ratingCount: 300,
  googlePlaceId: "google-place",
  pathId: "activity-path",
  parentPathId: null,
  position: 0,
};

describe("createPlannerRealtime subscriptions", () => {
  it("registers every planner event and removes every listener", () => {
    const context = setup();

    const unsubscribe = context.adapter.subscribe();

    expect(context.on.mock.calls.map(([eventName]) => eventName)).toEqual([
      "OnFolderCreated",
      "OnDayCreated",
      "OnActivityCreated",
      "OnPathUpdated",
      "OnProjectDateUpdated",
      "OnFolderUpdated",
      "OnDayUpdated",
      "OnActivityUpdated",
      "OnNodeDeleted",
    ]);

    context.emit("OnFolderCreated", {
      id: "remote-folder",
      name: "Remote",
      type: "wish",
      pathId: "remote-path",
      parentPathId: EMPTY_GUID,
      position: 1,
    });
    expect(context.state.nodes).toEqual([
      expect.objectContaining({ id: "remote-folder", parentPathId: null }),
    ]);

    unsubscribe();
    context.emit("OnNodeDeleted", { pathId: "remote-path" });
    expect(context.state.nodes).toHaveLength(1);
  });

  it("routes project events through the injected project action", () => {
    const context = setup();
    context.adapter.subscribe();
    const update: PlannerProjectUpdate = {
      publicId: "project-id",
      title: "Seoul",
      startDate: "2026-08-01",
      endDate: "2026-08-03",
      isPublic: true,
    };

    context.emit("OnProjectDateUpdated", update);

    expect(context.projectUpdates).toEqual([update]);
    expect(context.state.nodes).toEqual([]);
  });
});

describe("createPlannerRealtime commands", () => {
  it("applies create optimistically, serializes the wire request, and deduplicates sender echo", async () => {
    let resolveInvoke = () => {};
    const pendingInvoke = new Promise<void>((resolve) => {
      resolveInvoke = resolve;
    });
    const context = setup(() => pendingInvoke);
    context.adapter.subscribe();

    const result = context.adapter.commands.createActivity(activityInput);

    expect(context.state.nodes).toEqual([
      expect.objectContaining({
        kind: "activity",
        markerType: "museum",
        travelTime: 10,
        travelDistance: 800,
        parentPathId: null,
      }),
    ]);
    expect(context.invoke).toHaveBeenCalledWith("CreateActivity", {
      id: "activity-id",
      name: "Museum",
      type: "place",
      marker: "museum",
      travelMode: "walk",
      travelTimeMinutes: 10,
      travelDistanceMeters: 800,
      travelCost: "0",
      lat: 37.5,
      lng: 127,
      rating: 4.8,
      ratingCount: 300,
      googleId: "google-place",
      pathId: "activity-path",
      parentPathId: EMPTY_GUID,
      position: 0,
    });

    const wireRequest = context.invoke.mock
      .calls[0]?.[1] as PlannerHubEventMap["OnActivityCreated"];
    context.emit("OnActivityCreated", wireRequest);
    expect(context.state.nodes).toHaveLength(1);

    resolveInvoke();
    await result;
  });

  it("maps domain update names to the backend wire typo while updating domain state", async () => {
    const context = setup();
    await context.adapter.commands.createActivity(activityInput);

    await context.adapter.commands.updateActivity({
      id: "activity-id",
      markerType: null,
      travelTime: 22,
      travelDistance: 1500,
    });

    expect(context.invoke).toHaveBeenLastCalledWith("UpdateActivity", {
      id: "activity-id",
      marker: null,
      travelTimeMinuates: 22,
      travelDistanceMeters: 1500,
    });
    expect(context.state.nodes[0]).toMatchObject({
      markerType: null,
      travelTime: 22,
      travelDistance: 1500,
    });
  });

  it("exposes all typed planner commands with their exact Hub method names", async () => {
    const context = setup();
    const project = {
      publicId: "project-id",
      title: "Trip",
      startDate: "2026-08-01",
      endDate: "2026-08-03",
      isPublic: false,
    };

    await context.adapter.commands.createFolder(folderInput);
    await context.adapter.commands.createDay({
      id: "day-id",
      name: "Day 1",
      color: "blue",
      pathId: "day-path",
      parentPathId: "folder-path",
      position: 1,
    });
    await context.adapter.commands.updatePath({
      pathId: "day-path",
      parentPathId: null,
      position: 2,
    });
    await context.adapter.commands.updateProject(project);
    await context.adapter.commands.updateFolder({
      id: "folder-id",
      name: "Wishlist",
      folderType: "wish",
    });
    await context.adapter.commands.updateDay({
      id: "day-id",
      name: "Arrival",
      color: "green",
    });
    await context.adapter.commands.deleteNode({ pathId: "day-path" });

    expect(context.invoke.mock.calls.map(([methodName]) => methodName)).toEqual([
      "CreateFolder",
      "CreateDay",
      "UpdatePath",
      "UpdateProject",
      "UpdateFolder",
      "UpdateDay",
      "DeleteNode",
    ]);
    expect(context.invoke).toHaveBeenNthCalledWith(
      3,
      "UpdatePath",
      expect.objectContaining({ parentPathId: EMPTY_GUID }),
    );
    expect(context.projectUpdates).toEqual([project]);
  });

  it("reports a failed write, awaits one canonical resync, and never retries the invoke", async () => {
    const operationError = new Error("write failed");
    const order: string[] = [];
    const context = setup(() => {
      order.push("invoke");
      return Promise.reject(operationError);
    });
    context.reportError.mockImplementation(() => {
      order.push("report");
    });
    context.resync.mockImplementation(async () => {
      order.push("resync");
      context.state.nodes = [];
    });

    await expect(context.adapter.commands.createFolder(folderInput)).rejects.toBe(operationError);

    expect(context.state.nodes).toEqual([]);
    expect(context.invoke).toHaveBeenCalledTimes(1);
    expect(context.reportError).toHaveBeenCalledWith(operationError, {
      methodName: "CreateFolder",
      request: {
        id: "folder-id",
        name: "Trip",
        type: "default",
        pathId: "folder-path",
        parentPathId: EMPTY_GUID,
        position: 0,
      },
    });
    expect(context.resync).toHaveBeenCalledTimes(1);
    expect(order).toEqual(["invoke", "report", "resync"]);
  });
});
