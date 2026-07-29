import { createCursorRealtimeAdapter } from "@/features/collaboration/realtime/cursor-realtime-adapter";
import type {
  CursorPoint,
  CursorRatios,
  CursorUpdatedEvent,
  PlannerBounds,
  RemoteCursor,
} from "@/features/collaboration/types/cursor-presence";
import {
  clampCursorRatio,
  normalizeCursorPosition,
} from "@/features/collaboration/utils/cursor-coordinates";
import type { SignalRClient, SignalRConnectionStatus } from "@/lib/signalr-client";

const CURSOR_EXPIRY_MS = 3_000;
const CURSOR_SEND_INTERVAL_MS = 50;

export interface CursorPresenceController {
  dispose: () => void;
  getSnapshot: () => readonly RemoteCursor[];
  sendCursor: (point: CursorPoint, bounds: PlannerBounds) => void;
  setProjectId: (projectId: string) => void;
  subscribe: (listener: () => void) => () => void;
}

export interface CursorPresenceControllerOptions {
  readonly client: SignalRClient;
  readonly projectId: string;
  readonly userId: string;
}

function isValidCursorEvent(event: CursorUpdatedEvent): boolean {
  return event.userId.length > 0 && Number.isFinite(event.xRatio) && Number.isFinite(event.yRatio);
}

export function createCursorPresenceController({
  client,
  projectId: initialProjectId,
  userId,
}: CursorPresenceControllerOptions): CursorPresenceController {
  const adapter = createCursorRealtimeAdapter(client);
  const listeners = new Set<() => void>();
  const remoteCursors = new Map<string, RemoteCursor>();
  const expiryTimers = new Map<string, ReturnType<typeof setTimeout>>();
  let currentProjectId = initialProjectId;
  let currentStatus: SignalRConnectionStatus = client.getStatus();
  let snapshot: readonly RemoteCursor[] = [];
  let disposed = false;
  let lastSentAt: number | null = null;
  let pendingRatios: CursorRatios | null = null;
  let sendTimer: ReturnType<typeof setTimeout> | null = null;

  function publishSnapshot(): void {
    snapshot = Array.from(remoteCursors.values());
    listeners.forEach((listener) => listener());
  }

  function clearRemoteCursors(): void {
    expiryTimers.forEach((timer) => clearTimeout(timer));
    expiryTimers.clear();

    if (remoteCursors.size === 0) {
      return;
    }

    remoteCursors.clear();
    publishSnapshot();
  }

  function clearPendingSend(): void {
    if (sendTimer !== null) {
      clearTimeout(sendTimer);
      sendTimer = null;
    }

    pendingRatios = null;
    lastSentAt = null;
  }

  function clearPresence(): void {
    clearPendingSend();
    clearRemoteCursors();
  }

  function invokeCursorUpdate(ratios: CursorRatios): void {
    lastSentAt = Date.now();
    void adapter.updateCursor({ userId, ...ratios }).catch(() => undefined);
  }

  function flushPendingCursor(): void {
    sendTimer = null;

    if (disposed || currentStatus !== "connected" || pendingRatios === null) {
      pendingRatios = null;
      return;
    }

    const ratios = pendingRatios;
    pendingRatios = null;
    invokeCursorUpdate(ratios);
  }

  function scheduleCursorUpdate(ratios: CursorRatios): void {
    const now = Date.now();

    if (lastSentAt === null || now - lastSentAt >= CURSOR_SEND_INTERVAL_MS) {
      pendingRatios = null;

      if (sendTimer !== null) {
        clearTimeout(sendTimer);
        sendTimer = null;
      }

      invokeCursorUpdate(ratios);
      return;
    }

    pendingRatios = ratios;

    if (sendTimer === null) {
      sendTimer = setTimeout(flushPendingCursor, CURSOR_SEND_INTERVAL_MS - (now - lastSentAt));
    }
  }

  function expireCursor(userIdToExpire: string, lastUpdatedAt: number): void {
    const cursor = remoteCursors.get(userIdToExpire);

    if (!cursor || cursor.lastUpdatedAt !== lastUpdatedAt) {
      return;
    }

    expiryTimers.delete(userIdToExpire);
    remoteCursors.delete(userIdToExpire);
    publishSnapshot();
  }

  const unsubscribeCursor = adapter.onCursorUpdated((event) => {
    if (disposed || event.userId === userId || !isValidCursorEvent(event)) {
      return;
    }

    const lastUpdatedAt = Date.now();
    const previousTimer = expiryTimers.get(event.userId);

    if (previousTimer) {
      clearTimeout(previousTimer);
    }

    remoteCursors.set(event.userId, {
      userId: event.userId,
      xRatio: clampCursorRatio(event.xRatio),
      yRatio: clampCursorRatio(event.yRatio),
      lastUpdatedAt,
    });
    expiryTimers.set(
      event.userId,
      setTimeout(() => expireCursor(event.userId, lastUpdatedAt), CURSOR_EXPIRY_MS),
    );
    publishSnapshot();
  });

  const unsubscribeStatus = client.subscribeStatus((status) => {
    currentStatus = status;

    if (status !== "connected") {
      clearPresence();
    }
  });

  return {
    dispose() {
      if (disposed) {
        return;
      }

      disposed = true;
      unsubscribeCursor();
      unsubscribeStatus();
      clearPresence();
      listeners.clear();
    },
    getSnapshot() {
      return snapshot;
    },
    sendCursor(point, bounds) {
      if (disposed || currentStatus !== "connected") {
        return;
      }

      scheduleCursorUpdate(normalizeCursorPosition(point, bounds));
    },
    setProjectId(projectId) {
      if (disposed || projectId === currentProjectId) {
        return;
      }

      currentProjectId = projectId;
      clearPresence();
    },
    subscribe(listener) {
      if (disposed) {
        return () => undefined;
      }

      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
}
