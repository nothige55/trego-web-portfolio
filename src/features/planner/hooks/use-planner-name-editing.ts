import { useCallback, useState } from "react";

import type { PlannerNodeEditingCommands } from "@/features/planner/types/planner-editing-commands";
import type {
  FlattenedPlannerNode,
  PlannerNodePathId,
} from "@/features/planner/types/planner-node";

const FALLBACK_DAY_COLOR = "#F44336";

export type PlannerNameEditing = {
  readonly editingPathId: PlannerNodePathId | null;
  readonly draft: string;
  readonly begin: (node: FlattenedPlannerNode) => void;
  readonly cancel: () => void;
  readonly change: (name: string) => void;
  readonly commit: (node: FlattenedPlannerNode) => void;
};

// 행 이름의 인라인 편집 상태를 소유한다.
// Activity 이름은 서버 계약상 편집 대상이 아니므로 커밋 단계에서 걸러 낸다.
export function usePlannerNameEditing(commands?: PlannerNodeEditingCommands): PlannerNameEditing {
  const [editingPathId, setEditingPathId] = useState<PlannerNodePathId | null>(null);
  const [draft, setDraft] = useState("");

  const cancel = useCallback((): void => {
    setEditingPathId(null);
    setDraft("");
  }, []);

  const begin = useCallback((node: FlattenedPlannerNode): void => {
    setEditingPathId(node.pathId);
    setDraft(node.name);
  }, []);

  const commit = useCallback(
    (node: FlattenedPlannerNode): void => {
      if (!commands) {
        cancel();
        return;
      }

      const nextName = draft.trim();
      cancel();

      if (!nextName || nextName === node.name) {
        return;
      }

      if (node.kind === "activity") {
        return;
      }

      const operation =
        node.kind === "folder"
          ? commands.updateFolder({
              id: node.id,
              name: nextName,
              folderType: node.folderType ?? "default",
            })
          : commands.updateDay({
              id: node.id,
              name: nextName,
              color: node.color ?? FALLBACK_DAY_COLOR,
            });
      void operation.catch(() => undefined);
    },
    [cancel, commands, draft],
  );

  return { editingPathId, draft, begin, cancel, change: setDraft, commit };
}
