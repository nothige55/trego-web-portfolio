// SignalR 연결의 시작·재시도·중지 lifecycle과 연결 상태 구독만 담당
// Hub 메서드와 이벤트 이름은 모르며, 그 계약은 각 feature의 realtime 모듈이 소유

import { type HubConnection, HubConnectionBuilder, HubConnectionState } from "@microsoft/signalr";

import { env } from "@/config/env";

const DEFAULT_INITIAL_RETRY_DELAYS = [0, 2_000, 5_000] as const;
const DEFAULT_RECONNECT_DELAYS = [0, 2_000, 10_000, 30_000] as const;

export type SignalRConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

export type SignalRErrorContext = "connection-closed" | "initial-connect" | "invoke";

export interface SignalRClientOptions {
  readonly accessTokenFactory?: () =>
    | Promise<string | null | undefined>
    | string
    | null
    | undefined;
  readonly hubUrl?: string;
  readonly initialRetryDelays?: readonly number[];
  readonly onError?: (error: Error, context: SignalRErrorContext) => void;
  readonly reconnectDelays?: readonly number[];
}

export interface SignalRClient {
  getStatus: () => SignalRConnectionStatus;
  invoke: <TResult = void>(methodName: string, ...args: readonly unknown[]) => Promise<TResult>;
  on: <TArgs extends readonly unknown[]>(
    eventName: string,
    handler: (...args: TArgs) => void,
  ) => () => void;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  subscribeStatus: (listener: (status: SignalRConnectionStatus) => void) => () => void;
}

export class SignalRNotConnectedError extends Error {
  constructor() {
    super("SignalR connection is not established.");
    this.name = "SignalRNotConnectedError";
  }
}

class SignalRStartCancelledError extends Error {
  constructor() {
    super("SignalR connection start was cancelled.");
    this.name = "SignalRStartCancelledError";
  }
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function wait(delay: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return Promise.reject(new SignalRStartCancelledError());
  }

  if (delay === 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const handleAbort = () => {
      window.clearTimeout(timeoutId);
      reject(new SignalRStartCancelledError());
    };
    const timeoutId = window.setTimeout(() => {
      signal.removeEventListener("abort", handleAbort);
      resolve();
    }, delay);

    signal.addEventListener("abort", handleAbort, { once: true });
  });
}

function createConnection({
  accessTokenFactory,
  hubUrl,
  reconnectDelays,
}: Required<Pick<SignalRClientOptions, "hubUrl" | "reconnectDelays">> &
  Pick<SignalRClientOptions, "accessTokenFactory">): HubConnection {
  const builder = new HubConnectionBuilder();
  const connectionOptions = accessTokenFactory
    ? {
        accessTokenFactory: async () => (await accessTokenFactory()) ?? "",
      }
    : undefined;

  return builder
    .withUrl(hubUrl, connectionOptions ?? {})
    .withAutomaticReconnect([...reconnectDelays])
    .build();
}

export function createSignalRClient({
  accessTokenFactory,
  hubUrl = env.signalRHubUrl,
  initialRetryDelays = DEFAULT_INITIAL_RETRY_DELAYS,
  onError,
  reconnectDelays = DEFAULT_RECONNECT_DELAYS,
}: SignalRClientOptions = {}): SignalRClient {
  const connection = createConnection({ accessTokenFactory, hubUrl, reconnectDelays });
  const statusListeners = new Set<(status: SignalRConnectionStatus) => void>();
  let status: SignalRConnectionStatus = "idle";
  let startAbortController: AbortController | null = null;
  let startPromise: Promise<void> | null = null;
  let restartPromise: Promise<void> | null = null;
  let stopPromise: Promise<void> | null = null;
  let isManualStop = false;

  function setStatus(nextStatus: SignalRConnectionStatus): void {
    if (status === nextStatus) {
      return;
    }

    status = nextStatus;
    statusListeners.forEach((listener) => listener(status));
  }

  connection.onreconnecting(() => {
    setStatus("reconnecting");
  });

  connection.onreconnected(() => {
    setStatus("connected");
  });

  connection.onclose((error) => {
    if (isManualStop) {
      setStatus("idle");
      return;
    }

    setStatus("disconnected");

    if (error) {
      onError?.(error, "connection-closed");
    }
  });

  async function startWithRetry(signal: AbortSignal): Promise<void> {
    let lastError: Error | undefined;

    setStatus("connecting");

    for (const retryDelay of initialRetryDelays) {
      await wait(retryDelay, signal);

      if (connection.state === HubConnectionState.Connected) {
        setStatus("connected");
        return;
      }

      if (connection.state !== HubConnectionState.Disconnected) {
        throw new Error(`Cannot start SignalR while HubConnection is '${connection.state}'.`);
      }

      try {
        await connection.start();

        if (signal.aborted) {
          throw new SignalRStartCancelledError();
        }

        setStatus("connected");
        return;
      } catch (error) {
        if (error instanceof SignalRStartCancelledError) {
          throw error;
        }

        if (signal.aborted) {
          throw new SignalRStartCancelledError();
        }

        lastError = toError(error);

        if (connection.state !== HubConnectionState.Disconnected) {
          throw lastError;
        }
      }
    }

    const connectionError = lastError ?? new Error("SignalR connection failed to start.");
    setStatus("disconnected");
    onError?.(connectionError, "initial-connect");
    throw connectionError;
  }

  function startClient(): Promise<void> {
    if (restartPromise) {
      return restartPromise;
    }

    if (stopPromise) {
      restartPromise = stopPromise
        .catch(() => undefined)
        .then(() => {
          restartPromise = null;
          return startClient();
        });
      return restartPromise;
    }

    if (connection.state === HubConnectionState.Connected) {
      setStatus("connected");
      return Promise.resolve();
    }

    if (startPromise) {
      return startPromise;
    }

    if (connection.state === HubConnectionState.Reconnecting) {
      return Promise.reject(new Error("SignalR automatic reconnect is already in progress."));
    }

    if (connection.state === HubConnectionState.Disconnecting) {
      const connectionStop = connection.stop();
      const pendingStop = connectionStop.finally(() => {
        setStatus("idle");
        stopPromise = null;
      });
      stopPromise = pendingStop;
      return startClient();
    }

    if (connection.state !== HubConnectionState.Disconnected) {
      return Promise.reject(
        new Error(`Cannot start SignalR while HubConnection is '${connection.state}'.`),
      );
    }

    isManualStop = false;
    startAbortController = new AbortController();
    const pendingStart = startWithRetry(startAbortController.signal).finally(() => {
      startAbortController = null;
      startPromise = null;
    });
    startPromise = pendingStart;

    return startPromise;
  }

  function stopClient(): Promise<void> {
    if (stopPromise) {
      return stopPromise;
    }

    isManualStop = true;
    startAbortController?.abort();
    const pendingStart = startPromise;
    const connectionStop = connection.stop();
    const pendingStop = Promise.allSettled(
      pendingStart ? [connectionStop, pendingStart] : [connectionStop],
    ).then((results) => {
      const stopResult = results[0];

      if (stopResult?.status === "rejected") {
        throw stopResult.reason;
      }
    });

    const finalStop = pendingStop.finally(() => {
      setStatus("idle");
      stopPromise = null;
    });
    stopPromise = finalStop;

    return stopPromise;
  }

  return {
    getStatus() {
      return status;
    },
    async invoke<TResult = void>(methodName: string, ...args: readonly unknown[]) {
      if (connection.state !== HubConnectionState.Connected) {
        throw new SignalRNotConnectedError();
      }

      try {
        return await connection.invoke<TResult>(methodName, ...args);
      } catch (error) {
        const operationError = toError(error);
        onError?.(operationError, "invoke");
        throw operationError;
      }
    },
    on<TArgs extends readonly unknown[]>(eventName: string, handler: (...args: TArgs) => void) {
      connection.on(eventName, handler);

      return () => {
        connection.off(eventName, handler);
      };
    },
    start: startClient,
    stop: stopClient,
    subscribeStatus(listener: (nextStatus: SignalRConnectionStatus) => void) {
      statusListeners.add(listener);
      listener(status);

      return () => {
        statusListeners.delete(listener);
      };
    },
  };
}
