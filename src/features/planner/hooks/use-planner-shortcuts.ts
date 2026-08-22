import { useEffect } from "react";

import { usePlannerViewStore } from "@/features/planner/stores/planner-view-store";
import type { PlannerNodeEditingCommands } from "@/features/planner/types/planner-editing-commands";
import type { PlannerNodePathId } from "@/features/planner/types/planner-node";

function isTextInputTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

// 일정 패널 전역 단축키를 window에 붙인다.
// 트리에 포커스가 없어도 동작해야 하므로 요소 단위 핸들러 대신 window 리스너를 쓴다.
export function usePlannerShortcuts({
  commands,
  operationPathIds,
}: {
  readonly commands?: PlannerNodeEditingCommands;
  readonly operationPathIds: readonly PlannerNodePathId[];
}): void {
  const clearSelection = usePlannerViewStore((state) => state.clearSelection);

  useEffect(() => {
    const handlePlannerKeyDown = (event: KeyboardEvent): void => {
      if (isTextInputTarget(event.target) || event.isComposing) {
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        const historyCommand = event.shiftKey ? commands?.redo : commands?.undo;
        if (!historyCommand) {
          return;
        }
        event.preventDefault();
        void historyCommand().catch(() => undefined);
        return;
      }

      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "g" &&
        operationPathIds.length >= 2 &&
        commands?.groupNodes
      ) {
        event.preventDefault();
        void commands.groupNodes(operationPathIds).catch(() => undefined);
        return;
      }

      if ((event.key === "Delete" || event.key === "Backspace") && operationPathIds.length > 0) {
        const deleteOperation = commands?.deleteNodes
          ? () => commands.deleteNodes!(operationPathIds)
          : operationPathIds.length === 1 && commands?.deleteNode
            ? () => commands.deleteNode({ pathId: operationPathIds[0]! })
            : null;
        if (!deleteOperation) {
          return;
        }
        event.preventDefault();
        void deleteOperation().catch(() => undefined);
        return;
      }

      if (event.key === "Escape") {
        clearSelection();
      }
    };

    window.addEventListener("keydown", handlePlannerKeyDown);
    return () => window.removeEventListener("keydown", handlePlannerKeyDown);
  }, [clearSelection, commands, operationPathIds]);
}
