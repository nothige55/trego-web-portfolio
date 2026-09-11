// 실제 SignalRClient와 같은 상태 전이를 냄
// 회선이 끊기면 reconnecting으로 머물고, 회선이 돌아오면 새 서버 연결로 connected가 됨
// 새 연결은 그룹에 참여하지 않은 상태라, 실제와 마찬가지로 세션이 JoinProject와 resync를 다시 실행해야 함

import type { DemoNetwork } from "@/app/demo/demo-network";
import type { DemoProjectServer, DemoServerConnection } from "@/app/demo/demo-project-server";
import { simulateLatency } from "@/app/demo/simulate-latency";
import {
  type SignalRClient,
  type SignalRConnectionStatus,
  SignalRNotConnectedError,
} from "@/lib/signalr-client";

const DEFAULT_CONNECT_DELAY_MS = 300;
const DEFAULT_RECONNECT_DELAY_MS = 700;

export interface DemoSignalRClientOptions {
  readonly connectDelayMs?: number;
  readonly network: DemoNetwork;
  readonly reconnectDelayMs?: number;
  readonly server: DemoProjectServer;
}

class DemoStartCancelledError extends Error {
  constructor() {
    super("데모 실시간 연결 시작이 취소되었습니다.");
    this.name = "DemoStartCancelledError";
  }
}

type EventHandler = (...args: readonly unknown[]) => void;

export function createDemoSignalRClient({
  connectDelayMs = DEFAULT_CONNECT_DELAY_MS,
  network,
  reconnectDelayMs = DEFAULT_RECONNECT_DELAY_MS,
  server,
}: DemoSignalRClientOptions): SignalRClient {
  const statusListeners = new Set<(status: SignalRConnectionStatus) => void>();
  const eventHandlers = new Map<string, Set<EventHandler>>();
  let status: SignalRConnectionStatus = "idle";
  let connection: DemoServerConnection | null = null;
  let generation = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let unsubscribeNetwork: (() => void) | null = null;

  function setStatus(nextStatus: SignalRConnectionStatus): void {
    if (status === nextStatus) {
      return;
    }

    status = nextStatus;
    statusListeners.forEach((listener) => listener(status));
  }

  function dispatch(eventName: string, args: readonly unknown[]): void {
    eventHandlers.get(eventName)?.forEach((handler) => handler(...args));
  }

  function openConnection(): void {
    connection = server.connect(dispatch);
  }

  function closeConnection(): void {
    connection?.close();
    connection = null;
  }

  function clearReconnectTimer(): void {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function handleNetworkChange(): void {
    if (!network.isOnline()) {
      clearReconnectTimer();

      if (status === "connected") {
        closeConnection();
        setStatus("reconnecting");
      }

      return;
    }

    if (status === "reconnecting" && reconnectTimer === null) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;

        if (status === "reconnecting" && network.isOnline()) {
          openConnection();
          setStatus("connected");
        }
      }, reconnectDelayMs);
    }
  }

  return {
    getStatus() {
      return status;
    },
    async invoke<TResult = void>(methodName: string, ...args: readonly unknown[]) {
      if (status !== "connected" || !connection) {
        throw new SignalRNotConnectedError();
      }

      await connection.invoke(methodName, args);
      return undefined as TResult;
    },
    on<TArgs extends readonly unknown[]>(eventName: string, handler: (...args: TArgs) => void) {
      const handlers = eventHandlers.get(eventName) ?? new Set<EventHandler>();
      const eventHandler = handler as unknown as EventHandler;
      handlers.add(eventHandler);
      eventHandlers.set(eventName, handlers);

      return () => {
        handlers.delete(eventHandler);
      };
    },
    async start() {
      if (status === "connected") {
        return;
      }

      const startGeneration = ++generation;
      unsubscribeNetwork ??= network.subscribe(handleNetworkChange);
      setStatus("connecting");
      await simulateLatency(connectDelayMs);

      if (startGeneration !== generation) {
        throw new DemoStartCancelledError();
      }

      if (!network.isOnline()) {
        setStatus("disconnected");
        throw new Error("데모 서버에 연결하지 못했습니다. 연결을 다시 켜 주세요.");
      }

      openConnection();
      setStatus("connected");
    },
    async stop() {
      generation += 1;
      clearReconnectTimer();
      closeConnection();
      unsubscribeNetwork?.();
      unsubscribeNetwork = null;
      setStatus("idle");
    },
    subscribeStatus(listener) {
      statusListeners.add(listener);
      listener(status);

      return () => {
        statusListeners.delete(listener);
      };
    },
  };
}
