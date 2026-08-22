import { useCallback, useRef, useState } from "react";

import type { UpdatePathInput } from "@/features/planner/realtime/project-hub-planner-contracts";
import { usePlannerViewStore } from "@/features/planner/stores/planner-view-store";
import type { PlannerNodeMoveHandler } from "@/features/planner/types/planner-editing-commands";

export type PlannerNodeMove = {
  readonly isMovePending: boolean;
  readonly moveNode: PlannerNodeMoveHandler;
};

// 드래그로 확정된 이동을 낙관적으로 먼저 반영하고 서버 확인을 기다린다.
// 이동이 겹치면 되돌릴 기준 위치가 흔들리므로 한 번에 하나만 처리한다.
export function usePlannerNodeMove({
  isEnabled,
  updatePath,
}: {
  readonly isEnabled: boolean;
  readonly updatePath: (input: UpdatePathInput, previousInput: UpdatePathInput) => Promise<void>;
}): PlannerNodeMove {
  const [isMovePending, setIsMovePending] = useState(false);
  const movePromiseRef = useRef<Promise<void> | null>(null);

  const moveNode = useCallback<PlannerNodeMoveHandler>(
    (pathId, destination) => {
      if (!isEnabled || movePromiseRef.current) {
        return;
      }

      const currentNode = usePlannerViewStore.getState().tree.entityMap.get(pathId);
      if (!currentNode) {
        return;
      }

      const previousInput = {
        pathId,
        parentPathId: currentNode.parentPathId,
        position: currentNode.position,
      };
      usePlannerViewStore.getState().moveNode(pathId, destination);
      const movePromise = updatePath(
        {
          pathId,
          parentPathId: destination.parentPathId,
          position: destination.position,
        },
        previousInput,
      );
      movePromiseRef.current = movePromise;
      setIsMovePending(true);

      void movePromise
        .catch(() => undefined)
        .finally(() => {
          if (movePromiseRef.current === movePromise) {
            movePromiseRef.current = null;
            setIsMovePending(false);
          }
        });
    },
    [isEnabled, updatePath],
  );

  return { isMovePending, moveNode };
}
