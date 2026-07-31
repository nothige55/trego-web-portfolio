import { MousePointer2 } from "lucide-react";
import { type PointerEvent, type ReactNode, useCallback, useSyncExternalStore } from "react";

import type { CursorPresenceController } from "@/features/collaboration/realtime/cursor-presence-controller";

const EMPTY_CURSORS = [] as const;

type CursorPresenceLayerProps = {
  readonly children: ReactNode;
  readonly controller: CursorPresenceController | null;
  readonly enabled: boolean;
};

export function CursorPresenceLayer({ children, controller, enabled }: CursorPresenceLayerProps) {
  const subscribe = useCallback(
    (listener: () => void) => controller?.subscribe(listener) ?? (() => undefined),
    [controller],
  );
  const getSnapshot = useCallback(() => controller?.getSnapshot() ?? EMPTY_CURSORS, [controller]);
  const remoteCursors = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!enabled || !controller) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) {
      return;
    }

    controller.sendCursor(
      { x: event.clientX, y: event.clientY },
      { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height },
    );
  }

  return (
    <div
      data-testid="cursor-presence-surface"
      className="relative h-svh overflow-hidden"
      onPointerMove={handlePointerMove}
    >
      {children}
      <div aria-label="원격 사용자 커서" className="pointer-events-none absolute inset-0 z-60">
        {remoteCursors.map((cursor) => (
          <div
            key={cursor.userId}
            data-testid={`remote-cursor-${cursor.userId}`}
            className="absolute -translate-x-1 -translate-y-1 text-brand drop-shadow-sm"
            style={{ left: `${cursor.xRatio * 100}%`, top: `${cursor.yRatio * 100}%` }}
          >
            <MousePointer2 aria-hidden="true" className="size-5 fill-brand/20" />
            <span className="ml-3 inline-flex -translate-y-1 rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold text-brand-foreground shadow-sm">
              {cursor.userId.slice(0, 8)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
