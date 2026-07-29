import type {
  CursorUpdatedEvent,
  UpdateCursorCommand,
} from "@/features/collaboration/types/cursor-presence";
import type { SignalRClient } from "@/lib/signalr-client";

const CURSOR_UPDATED_EVENT = "OnCursorUpdated";
const UPDATE_CURSOR_METHOD = "UpdateCursor";

export interface CursorRealtimeAdapter {
  onCursorUpdated: (handler: (event: CursorUpdatedEvent) => void) => () => void;
  updateCursor: (command: UpdateCursorCommand) => Promise<void>;
}

export function createCursorRealtimeAdapter(client: SignalRClient): CursorRealtimeAdapter {
  return {
    onCursorUpdated(handler) {
      return client.on<[string, number, number]>(CURSOR_UPDATED_EVENT, (userId, xRatio, yRatio) => {
        handler({ userId, xRatio, yRatio });
      });
    },
    updateCursor({ userId, xRatio, yRatio }) {
      return client.invoke(UPDATE_CURSOR_METHOD, userId, xRatio, yRatio);
    },
  };
}
