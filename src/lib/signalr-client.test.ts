import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createSignalRClient,
  type SignalRConnectionStatus,
  SignalRNotConnectedError,
} from "@/lib/signalr-client";

const signalRMock = vi.hoisted(() => {
  const callbacks: {
    close?: (error?: Error) => void;
    reconnected?: (connectionId?: string) => void;
    reconnecting?: (error?: Error) => void;
  } = {};

  const connection = {
    invoke: vi.fn(),
    off: vi.fn(),
    on: vi.fn(),
    onclose: vi.fn((callback: (error?: Error) => void) => {
      callbacks.close = callback;
    }),
    onreconnected: vi.fn((callback: (connectionId?: string) => void) => {
      callbacks.reconnected = callback;
    }),
    onreconnecting: vi.fn((callback: (error?: Error) => void) => {
      callbacks.reconnecting = callback;
    }),
    start: vi.fn(),
    stop: vi.fn(),
  };

  const builder = {
    build: vi.fn(() => connection),
    withAutomaticReconnect: vi.fn(),
    withUrl: vi.fn(),
  };

  return { builder, callbacks, connection };
});

vi.mock("@microsoft/signalr", () => ({
  HubConnectionBuilder: class HubConnectionBuilder {
    build() {
      return signalRMock.builder.build();
    }

    withAutomaticReconnect(delays: number[]) {
      signalRMock.builder.withAutomaticReconnect(delays);
      return this;
    }

    withUrl(url: string, options: object) {
      signalRMock.builder.withUrl(url, options);
      return this;
    }
  },
}));

describe("createSignalRClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signalRMock.connection.start.mockResolvedValue(undefined);
    signalRMock.connection.stop.mockResolvedValue(undefined);
  });

  it("configures the hub URL, access token, and reconnect delays", async () => {
    const accessTokenFactory = vi.fn().mockResolvedValue("token");

    createSignalRClient({
      accessTokenFactory,
      hubUrl: "https://api.example.com/project",
      reconnectDelays: [0, 1_000],
    });

    expect(signalRMock.builder.withAutomaticReconnect).toHaveBeenCalledWith([0, 1_000]);
    expect(signalRMock.builder.withUrl).toHaveBeenCalledWith(
      "https://api.example.com/project",
      expect.objectContaining({ accessTokenFactory: expect.any(Function) }),
    );

    const options = signalRMock.builder.withUrl.mock.calls[0]?.[1] as {
      accessTokenFactory: () => Promise<string>;
    };
    expect(await options.accessTokenFactory()).toBe("token");
  });

  it("shares one in-flight start and publishes status changes", async () => {
    let resolveStart: (() => void) | undefined;
    signalRMock.connection.start.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveStart = resolve;
      }),
    );
    const client = createSignalRClient();
    const statuses: SignalRConnectionStatus[] = [];
    client.subscribeStatus((status) => statuses.push(status));

    const firstStart = client.start();
    const secondStart = client.start();

    expect(firstStart).toBe(secondStart);
    await Promise.resolve();
    expect(signalRMock.connection.start).toHaveBeenCalledTimes(1);

    resolveStart?.();
    await firstStart;

    expect(statuses).toEqual(["idle", "connecting", "connected"]);
  });

  it("retries the initial connection with the configured bounded schedule", async () => {
    vi.useFakeTimers();
    const connectionError = new Error("offline");
    const onError = vi.fn();
    signalRMock.connection.start.mockRejectedValue(connectionError);
    const client = createSignalRClient({
      initialRetryDelays: [0, 2_000, 5_000],
      onError,
    });

    const startPromise = client.start();
    const rejection = expect(startPromise).rejects.toThrow("offline");
    await vi.runAllTimersAsync();
    await rejection;

    expect(signalRMock.connection.start).toHaveBeenCalledTimes(3);
    expect(client.getStatus()).toBe("disconnected");
    expect(onError).toHaveBeenCalledWith(connectionError, "initial-connect");
    vi.useRealTimers();
  });

  it("reflects automatic reconnect lifecycle callbacks", async () => {
    const client = createSignalRClient();
    const statuses: SignalRConnectionStatus[] = [];
    client.subscribeStatus((status) => statuses.push(status));
    await client.start();

    signalRMock.callbacks.reconnecting?.(new Error("lost"));
    signalRMock.callbacks.reconnected?.("connection-id");
    signalRMock.callbacks.close?.(new Error("closed"));

    expect(statuses).toEqual([
      "idle",
      "connecting",
      "connected",
      "reconnecting",
      "connected",
      "disconnected",
    ]);
  });

  it("registers removable event handlers and invokes only while connected", async () => {
    const client = createSignalRClient();
    const handler = vi.fn();
    const unsubscribe = client.on<[string]>("OnMessageReceived", handler);

    expect(signalRMock.connection.on).toHaveBeenCalledWith("OnMessageReceived", handler);
    await expect(client.invoke("SendMessage", { content: "hello" })).rejects.toBeInstanceOf(
      SignalRNotConnectedError,
    );

    signalRMock.connection.invoke.mockResolvedValue("result");
    await client.start();
    await expect(client.invoke<string>("SendMessage", { content: "hello" })).resolves.toBe(
      "result",
    );

    unsubscribe();
    expect(signalRMock.connection.off).toHaveBeenCalledWith("OnMessageReceived", handler);
  });

  it("shares one stop call and returns to idle", async () => {
    let resolveStop: (() => void) | undefined;
    signalRMock.connection.stop.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveStop = resolve;
      }),
    );
    const client = createSignalRClient();
    await client.start();

    const firstStop = client.stop();
    const secondStop = client.stop();

    expect(firstStop).toBe(secondStop);
    expect(signalRMock.connection.stop).toHaveBeenCalledTimes(1);

    resolveStop?.();
    await firstStop;
    expect(client.getStatus()).toBe("idle");
  });
});
