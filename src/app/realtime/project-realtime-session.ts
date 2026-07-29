import type { SignalRClient, SignalRConnectionStatus } from "@/lib/signalr-client";

export interface ProjectRealtimeSessionSnapshot {
  readonly error: Error | null;
  readonly isReady: boolean;
  readonly status: SignalRConnectionStatus;
}

export interface ProjectRealtimeSession {
  getSnapshot: () => ProjectRealtimeSessionSnapshot;
  retry: () => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  subscribe: (listener: (snapshot: ProjectRealtimeSessionSnapshot) => void) => () => void;
}

export interface ProjectRealtimeSessionOptions {
  readonly client: SignalRClient;
  readonly onError?: (error: Error) => void;
  readonly projectId: string;
  readonly registerSubscriptions: (client: SignalRClient) => (() => void) | void;
  readonly resync: () => Promise<void>;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export function createProjectRealtimeSession({
  client,
  onError,
  projectId,
  registerSubscriptions,
  resync,
}: ProjectRealtimeSessionOptions): ProjectRealtimeSession {
  const listeners = new Set<(snapshot: ProjectRealtimeSessionSnapshot) => void>();
  const unregisterSubscriptions = registerSubscriptions(client) ?? (() => undefined);
  let snapshot: ProjectRealtimeSessionSnapshot = {
    error: null,
    isReady: false,
    status: client.getStatus(),
  };
  let hasJoined = false;
  let isStopped = false;
  let operationPromise: Promise<void> | null = null;
  let previousTransportStatus = client.getStatus();

  function publish(nextSnapshot: ProjectRealtimeSessionSnapshot): void {
    snapshot = nextSnapshot;
    listeners.forEach((listener) => listener(snapshot));
  }

  async function connectJoinAndSync(shouldResync: boolean): Promise<void> {
    if (isStopped) {
      throw new Error("Project realtime session is stopped.");
    }

    if (operationPromise) {
      return operationPromise;
    }

    operationPromise = (async () => {
      publish({ ...snapshot, error: null, isReady: false });

      try {
        await client.start();
        await client.invoke("JoinProject", projectId);

        if (shouldResync) {
          await resync();
        }

        hasJoined = true;
        publish({ error: null, isReady: true, status: client.getStatus() });
      } catch (error) {
        const sessionError = toError(error);
        publish({ error: sessionError, isReady: false, status: client.getStatus() });
        onError?.(sessionError);
        throw sessionError;
      } finally {
        operationPromise = null;
      }
    })();

    return operationPromise;
  }

  const unsubscribeStatus = client.subscribeStatus((status) => {
    const shouldRecover =
      status === "connected" && previousTransportStatus === "reconnecting" && hasJoined;
    previousTransportStatus = status;

    if (status === "reconnecting" || status === "disconnected") {
      publish({ ...snapshot, isReady: false, status });
    } else {
      publish({ ...snapshot, status });
    }

    if (shouldRecover) {
      void connectJoinAndSync(true).catch(() => undefined);
    }
  });

  return {
    getSnapshot() {
      return snapshot;
    },
    retry() {
      return connectJoinAndSync(hasJoined);
    },
    start() {
      return connectJoinAndSync(false);
    },
    async stop() {
      if (isStopped) {
        return;
      }

      isStopped = true;
      unregisterSubscriptions();
      unsubscribeStatus();
      listeners.clear();
      await client.stop();
    },
    subscribe(listener: (nextSnapshot: ProjectRealtimeSessionSnapshot) => void) {
      listeners.add(listener);
      listener(snapshot);

      return () => {
        listeners.delete(listener);
      };
    },
  };
}
