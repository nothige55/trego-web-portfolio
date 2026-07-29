import { afterEach, describe, expect, it, vi } from "vitest";

import { createCursorPresenceController } from "@/features/collaboration/realtime/cursor-presence-controller";
import type { SignalRClient, SignalRConnectionStatus } from "@/lib/signalr-client";

type EventHandler = (...args: readonly unknown[]) => void;

function createFakeClient(initialStatus: SignalRConnectionStatus = "connected") {
  const eventHandlers = new Map<string, Set<EventHandler>>();
  const statusListeners = new Set<(status: SignalRConnectionStatus) => void>();
  const invoke = vi.fn().mockResolvedValue(undefined);
  let status = initialStatus;

  const client: SignalRClient = {
    getStatus: () => status,
    invoke<TResult>(methodName: string, ...args: readonly unknown[]) {
      return invoke(methodName, ...args) as Promise<TResult>;
    },
    on<TArgs extends readonly unknown[]>(eventName: string, handler: (...args: TArgs) => void) {
      const handlers = eventHandlers.get(eventName) ?? new Set<EventHandler>();
      const eventHandler = handler as EventHandler;
      handlers.add(eventHandler);
      eventHandlers.set(eventName, handlers);

      return () => {
        handlers.delete(eventHandler);
      };
    },
    start: () => Promise.resolve(),
    stop: () => Promise.resolve(),
    subscribeStatus(listener) {
      statusListeners.add(listener);
      listener(status);

      return () => {
        statusListeners.delete(listener);
      };
    },
  };

  return {
    client,
    emit(eventName: string, ...args: readonly unknown[]) {
      eventHandlers.get(eventName)?.forEach((handler) => handler(...args));
    },
    getHandlerCount(eventName: string) {
      return eventHandlers.get(eventName)?.size ?? 0;
    },
    getStatusListenerCount() {
      return statusListeners.size;
    },
    invoke,
    setStatus(nextStatus: SignalRConnectionStatus) {
      status = nextStatus;
      statusListeners.forEach((listener) => listener(status));
    },
  };
}

const plannerBounds = {
  left: 100,
  top: 50,
  width: 400,
  height: 200,
};

afterEach(() => {
  vi.useRealTimers();
});

describe("createCursorPresenceController", () => {
  it("uses the typed Hub contract and sends at most 20 updates per second", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const fakeClient = createFakeClient();
    const controller = createCursorPresenceController({
      client: fakeClient.client,
      projectId: "project-one",
      userId: "current-user",
    });

    controller.sendCursor({ x: 100, y: 50 }, plannerBounds);
    controller.sendCursor({ x: 300, y: 100 }, plannerBounds);
    controller.sendCursor({ x: 500, y: 250 }, plannerBounds);

    expect(fakeClient.invoke).toHaveBeenCalledTimes(1);
    expect(fakeClient.invoke).toHaveBeenLastCalledWith("UpdateCursor", "current-user", 0, 0);

    await vi.advanceTimersByTimeAsync(49);
    expect(fakeClient.invoke).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(fakeClient.invoke).toHaveBeenCalledTimes(2);
    expect(fakeClient.invoke).toHaveBeenLastCalledWith("UpdateCursor", "current-user", 1, 1);

    controller.dispose();
  });

  it("silently skips sends while disconnected and drops a queued send on disconnect", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const fakeClient = createFakeClient("disconnected");
    const controller = createCursorPresenceController({
      client: fakeClient.client,
      projectId: "project-one",
      userId: "current-user",
    });

    controller.sendCursor({ x: 300, y: 100 }, plannerBounds);
    expect(fakeClient.invoke).not.toHaveBeenCalled();

    fakeClient.setStatus("connected");
    controller.sendCursor({ x: 100, y: 50 }, plannerBounds);
    controller.sendCursor({ x: 500, y: 250 }, plannerBounds);
    expect(fakeClient.invoke).toHaveBeenCalledTimes(1);

    fakeClient.setStatus("reconnecting");
    await vi.advanceTimersByTimeAsync(50);
    expect(fakeClient.invoke).toHaveBeenCalledTimes(1);

    controller.sendCursor({ x: 300, y: 100 }, plannerBounds);
    expect(fakeClient.invoke).toHaveBeenCalledTimes(1);

    controller.dispose();
  });

  it("ignores the current user, clamps remote ratios, and expires cursors after three seconds", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const fakeClient = createFakeClient();
    const controller = createCursorPresenceController({
      client: fakeClient.client,
      projectId: "project-one",
      userId: "current-user",
    });
    const listener = vi.fn();
    controller.subscribe(listener);

    fakeClient.emit("OnCursorUpdated", "current-user", 0.25, 0.5);
    expect(controller.getSnapshot()).toEqual([]);
    expect(listener).not.toHaveBeenCalled();

    fakeClient.emit("OnCursorUpdated", "teammate", 1.5, -0.5);
    expect(controller.getSnapshot()).toEqual([
      {
        userId: "teammate",
        xRatio: 1,
        yRatio: 0,
        lastUpdatedAt: 1_000,
      },
    ]);
    expect(listener).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(2_999);
    expect(controller.getSnapshot()).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(controller.getSnapshot()).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(2);

    controller.dispose();
  });

  it("refreshes a remote cursor expiry when a newer event arrives", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const fakeClient = createFakeClient();
    const controller = createCursorPresenceController({
      client: fakeClient.client,
      projectId: "project-one",
      userId: "current-user",
    });

    fakeClient.emit("OnCursorUpdated", "teammate", 0.1, 0.2);
    await vi.advanceTimersByTimeAsync(2_000);
    fakeClient.emit("OnCursorUpdated", "teammate", 0.3, 0.4);
    await vi.advanceTimersByTimeAsync(1_000);

    expect(controller.getSnapshot()).toEqual([
      {
        userId: "teammate",
        xRatio: 0.3,
        yRatio: 0.4,
        lastUpdatedAt: 2_000,
      },
    ]);

    await vi.advanceTimersByTimeAsync(2_000);
    expect(controller.getSnapshot()).toEqual([]);

    controller.dispose();
  });

  it("clears cursors and queued sends on project switch, disconnect, and dispose", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const fakeClient = createFakeClient();
    const controller = createCursorPresenceController({
      client: fakeClient.client,
      projectId: "project-one",
      userId: "current-user",
    });

    fakeClient.emit("OnCursorUpdated", "teammate", 0.1, 0.2);
    controller.sendCursor({ x: 100, y: 50 }, plannerBounds);
    controller.sendCursor({ x: 500, y: 250 }, plannerBounds);
    controller.setProjectId("project-two");

    expect(controller.getSnapshot()).toEqual([]);
    await vi.advanceTimersByTimeAsync(50);
    expect(fakeClient.invoke).toHaveBeenCalledTimes(1);

    fakeClient.emit("OnCursorUpdated", "teammate", 0.3, 0.4);
    fakeClient.setStatus("disconnected");
    expect(controller.getSnapshot()).toEqual([]);

    controller.dispose();
    controller.dispose();
    expect(fakeClient.getHandlerCount("OnCursorUpdated")).toBe(0);
    expect(fakeClient.getStatusListenerCount()).toBe(0);

    fakeClient.emit("OnCursorUpdated", "late-event", 0.5, 0.5);
    await vi.runAllTimersAsync();
    expect(controller.getSnapshot()).toEqual([]);
  });
});
