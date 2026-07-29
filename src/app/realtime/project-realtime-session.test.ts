import { describe, expect, it, vi } from "vitest";

import { createProjectRealtimeSession } from "@/app/realtime/project-realtime-session";
import type { SignalRClient, SignalRConnectionStatus } from "@/lib/signalr-client";

function createFakeClient(order: string[] = []) {
  const statusListeners = new Set<(status: SignalRConnectionStatus) => void>();
  let status: SignalRConnectionStatus = "idle";

  const invokeMock = vi.fn(async (methodName: string) => {
    order.push(`invoke:${methodName}`);
    return undefined;
  });
  const client: SignalRClient = {
    getStatus: () => status,
    invoke: invokeMock as SignalRClient["invoke"],
    on: vi.fn(() => () => undefined),
    start: vi.fn(async () => {
      if (status === "connected") {
        return;
      }

      order.push("start");
      emit("connecting");
      emit("connected");
    }),
    stop: vi.fn(async () => {
      order.push("stop");
      emit("idle");
    }),
    subscribeStatus: vi.fn((listener: (nextStatus: SignalRConnectionStatus) => void) => {
      statusListeners.add(listener);
      listener(status);
      return () => statusListeners.delete(listener);
    }),
  };

  function emit(nextStatus: SignalRConnectionStatus): void {
    status = nextStatus;
    statusListeners.forEach((listener) => listener(status));
  }

  return { client, emit, invokeMock };
}

describe("createProjectRealtimeSession", () => {
  it("registers feature events before connecting and joins the project once", async () => {
    const order: string[] = [];
    const { client } = createFakeClient(order);
    const session = createProjectRealtimeSession({
      client,
      projectId: "project-id",
      registerSubscriptions: () => {
        order.push("register");
      },
      resync: vi.fn(),
    });

    await session.start();

    expect(order).toEqual(["register", "start", "invoke:JoinProject"]);
    expect(client.invoke).toHaveBeenCalledWith("JoinProject", "project-id");
    expect(session.getSnapshot()).toMatchObject({ isReady: true, status: "connected" });
  });

  it("rejoins before resyncing after automatic reconnect", async () => {
    const order: string[] = [];
    const { client, emit } = createFakeClient(order);
    const resync = vi.fn(async () => {
      order.push("resync");
    });
    const session = createProjectRealtimeSession({
      client,
      projectId: "project-id",
      registerSubscriptions: vi.fn(),
      resync,
    });
    await session.start();
    order.length = 0;

    emit("reconnecting");
    expect(session.getSnapshot().isReady).toBe(false);
    emit("connected");
    await vi.waitFor(() => expect(resync).toHaveBeenCalledTimes(1));

    expect(order).toEqual(["invoke:JoinProject", "resync"]);
    expect(session.getSnapshot()).toMatchObject({ isReady: true, status: "connected" });
  });

  it("uses manual retry to rejoin and resync after a disconnected session", async () => {
    const { client, emit } = createFakeClient();
    const resync = vi.fn();
    const session = createProjectRealtimeSession({
      client,
      projectId: "project-id",
      registerSubscriptions: vi.fn(),
      resync,
    });
    await session.start();
    emit("disconnected");

    await session.retry();

    expect(client.start).toHaveBeenCalledTimes(2);
    expect(client.invoke).toHaveBeenCalledTimes(2);
    expect(resync).toHaveBeenCalledTimes(1);
  });

  it("surfaces join failures without marking writes as ready", async () => {
    const { client, invokeMock } = createFakeClient();
    const joinError = new Error("join failed");
    invokeMock.mockRejectedValue(joinError);
    const onError = vi.fn();
    const session = createProjectRealtimeSession({
      client,
      onError,
      projectId: "project-id",
      registerSubscriptions: vi.fn(),
      resync: vi.fn(),
    });

    await expect(session.start()).rejects.toThrow("join failed");

    expect(session.getSnapshot()).toMatchObject({ error: joinError, isReady: false });
    expect(onError).toHaveBeenCalledWith(joinError);
  });

  it("removes feature subscriptions and stops the old project connection", async () => {
    const { client } = createFakeClient();
    const unregister = vi.fn();
    const session = createProjectRealtimeSession({
      client,
      projectId: "first-project",
      registerSubscriptions: () => unregister,
      resync: vi.fn(),
    });
    await session.start();

    await session.stop();
    await session.stop();

    expect(unregister).toHaveBeenCalledTimes(1);
    expect(client.stop).toHaveBeenCalledTimes(1);
  });
});
