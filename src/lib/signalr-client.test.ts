import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createSignalRClient,
  type SignalRConnectionStatus,
  SignalRNotConnectedError,
} from "@/lib/signalr-client";

const signalRMock = vi.hoisted(() => {
  const states = {
    Connected: "Connected",
    Connecting: "Connecting",
    Disconnected: "Disconnected",
    Disconnecting: "Disconnecting",
    Reconnecting: "Reconnecting",
  } as const;
  const callbacks: {
    close?: (error?: Error) => void;
    reconnected?: (connectionId?: string) => void;
    reconnecting?: (error?: Error) => void;
  } = {};
  let state: (typeof states)[keyof typeof states] = states.Disconnected;

  const connection = {
    get state() {
      return state;
    },
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

  return {
    builder,
    callbacks,
    connection,
    emitClose(error?: Error) {
      state = states.Disconnected;
      callbacks.close?.(error);
    },
    emitReconnected() {
      state = states.Connected;
      callbacks.reconnected?.("connection-id");
    },
    emitReconnecting(error?: Error) {
      state = states.Reconnecting;
      callbacks.reconnecting?.(error);
    },
    setState(nextState: (typeof states)[keyof typeof states]) {
      state = nextState;
    },
    states,
  };
});

vi.mock("@microsoft/signalr", () => ({
  HubConnectionState: signalRMock.states,
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
    signalRMock.setState(signalRMock.states.Disconnected);
    signalRMock.connection.start.mockImplementation(async () => {
      if (signalRMock.connection.state !== signalRMock.states.Disconnected) {
        throw new Error("Cannot start a HubConnection that is not in the 'Disconnected' state.");
      }

      signalRMock.setState(signalRMock.states.Connecting);
      signalRMock.setState(signalRMock.states.Connected);
    });
    signalRMock.connection.stop.mockImplementation(async () => {
      if (signalRMock.connection.state === signalRMock.states.Disconnected) {
        return;
      }

      signalRMock.setState(signalRMock.states.Disconnecting);
      signalRMock.emitClose();
    });
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
    signalRMock.connection.start.mockImplementationOnce(() => {
      signalRMock.setState(signalRMock.states.Connecting);
      return new Promise<void>((resolve) => {
        resolveStart = () => {
          signalRMock.setState(signalRMock.states.Connected);
          resolve();
        };
      });
    });
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
    signalRMock.connection.start.mockImplementation(async () => {
      signalRMock.setState(signalRMock.states.Connecting);
      signalRMock.setState(signalRMock.states.Disconnected);
      throw connectionError;
    });
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

    signalRMock.emitReconnecting(new Error("lost"));
    signalRMock.emitReconnected();
    signalRMock.emitClose(new Error("closed"));

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

  it("uses the actual HubConnection state before invoking", async () => {
    const client = createSignalRClient();
    await client.start();
    signalRMock.setState(signalRMock.states.Reconnecting);

    await expect(client.invoke("SendMessage", { content: "hello" })).rejects.toBeInstanceOf(
      SignalRNotConnectedError,
    );

    expect(signalRMock.connection.invoke).not.toHaveBeenCalled();
  });

  it("shares one stop call and returns to idle", async () => {
    let resolveStop: (() => void) | undefined;
    signalRMock.connection.stop.mockImplementationOnce(() => {
      signalRMock.setState(signalRMock.states.Disconnecting);
      return new Promise<void>((resolve) => {
        resolveStop = () => {
          signalRMock.emitClose();
          resolve();
        };
      });
    });
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

  it("starts a fresh connection after a development cleanup cancels an in-flight start", async () => {
    let rejectFirstStart: ((error: Error) => void) | undefined;
    signalRMock.connection.start
      .mockImplementationOnce(() => {
        signalRMock.setState(signalRMock.states.Connecting);
        return new Promise<void>((_resolve, reject) => {
          rejectFirstStart = reject;
        });
      })
      .mockImplementationOnce(async () => {
        signalRMock.setState(signalRMock.states.Connecting);
        signalRMock.setState(signalRMock.states.Connected);
      });
    signalRMock.connection.stop.mockImplementationOnce(async () => {
      signalRMock.setState(signalRMock.states.Disconnecting);
      signalRMock.setState(signalRMock.states.Disconnected);
      rejectFirstStart?.(new Error("The connection was stopped before startup completed."));
    });
    const onError = vi.fn();
    const client = createSignalRClient({ onError });

    const cancelledStart = client.start();
    const cancelledStartExpectation = expect(cancelledStart).rejects.toThrow(
      "SignalR connection start was cancelled",
    );
    await vi.waitFor(() => expect(signalRMock.connection.start).toHaveBeenCalledTimes(1));
    const stop = client.stop();
    const restarted = client.start();
    const duplicateRestart = client.start();

    expect(restarted).toBe(duplicateRestart);

    await cancelledStartExpectation;
    await stop;
    await restarted;

    expect(signalRMock.connection.start).toHaveBeenCalledTimes(2);
    expect(client.getStatus()).toBe("connected");
    expect(onError).not.toHaveBeenCalled();
  });

  it("does not continue bounded retries after a delayed start is cancelled", async () => {
    vi.useFakeTimers();
    const connectionError = new Error("offline");
    signalRMock.connection.start.mockImplementationOnce(async () => {
      signalRMock.setState(signalRMock.states.Connecting);
      signalRMock.setState(signalRMock.states.Disconnected);
      throw connectionError;
    });
    const client = createSignalRClient();

    const start = client.start();
    const startExpectation = expect(start).rejects.toThrow(
      "SignalR connection start was cancelled",
    );
    await vi.waitFor(() => expect(signalRMock.connection.start).toHaveBeenCalledTimes(1));

    await client.stop();
    await vi.runAllTimersAsync();
    await startExpectation;

    expect(signalRMock.connection.start).toHaveBeenCalledTimes(1);
    expect(client.getStatus()).toBe("idle");
    vi.useRealTimers();
  });

  it("does not manually start while automatic reconnect is in progress", async () => {
    const client = createSignalRClient();
    await client.start();
    signalRMock.emitReconnecting(new Error("lost"));

    await expect(client.start()).rejects.toThrow("automatic reconnect is already in progress");

    expect(signalRMock.connection.start).toHaveBeenCalledTimes(1);
    expect(client.getStatus()).toBe("reconnecting");
  });

  it("allows a fresh manual start after automatic reconnect is exhausted", async () => {
    const client = createSignalRClient();
    await client.start();
    signalRMock.emitReconnecting(new Error("lost"));
    signalRMock.emitClose();

    await client.start();

    expect(signalRMock.connection.start).toHaveBeenCalledTimes(2);
    expect(client.getStatus()).toBe("connected");
  });
});
