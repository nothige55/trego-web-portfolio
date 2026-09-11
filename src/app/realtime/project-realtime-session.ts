// start → JoinProject → resync를 하나의 in-flight promise로 직렬화하는, React와 무관한 프로젝트 실시간 세션
// reconnecting 뒤 connected로 돌아오면 join과 resync를 다시 실행

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

  function assertActive(): void {
    if (isStopped) {
      throw new Error("Project realtime session is stopped.");
    }
  }

  async function connectJoinAndSync(): Promise<void> {
    assertActive();

    if (operationPromise) {
      return operationPromise;
    }

    operationPromise = (async () => {
      publish({ ...snapshot, error: null, isReady: false });

      try {
        await client.start();
        assertActive();
        await client.invoke("JoinProject", projectId);
        assertActive();
        hasJoined = true;
        await resync();
        assertActive();
        publish({ error: null, isReady: true, status: client.getStatus() });
      } catch (error) {
        const sessionError = toError(error);

        if (isStopped) {
          throw sessionError;
        }

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

    if (status === "reconnecting") {
      publish({ ...snapshot, error: null, isReady: false, status });
    } else if (status === "disconnected") {
      publish({ ...snapshot, isReady: false, status });
    } else {
      publish({ ...snapshot, status });
    }

    if (shouldRecover) {
      void connectJoinAndSync().catch(() => undefined);
    }
  });

  return {
    getSnapshot() {
      return snapshot;
    },
    retry() {
      const canRetry =
        snapshot.status === "disconnected" ||
        (snapshot.status === "connected" && snapshot.error !== null);

      if (!canRetry) {
        return Promise.reject(
          new Error(`Cannot retry realtime session while status is '${snapshot.status}'.`),
        );
      }

      return connectJoinAndSync();
    },
    start() {
      return connectJoinAndSync();
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
