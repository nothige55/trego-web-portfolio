import { useCallback, useState } from "react";

import { usePlannerViewStore } from "@/features/planner/stores/planner-view-store";
import type { PlannerNodeEditingCommands } from "@/features/planner/types/planner-editing-commands";
import type { PlannerNodePathId } from "@/features/planner/types/planner-node";

const MEMO_SAVE_ERROR_MESSAGE = "메모를 저장하지 못했습니다. 다시 시도해 주세요.";

export type PlannerMemoEditing = {
  readonly editingPathId: PlannerNodePathId | null;
  readonly draft: string;
  readonly error: string | null;
  readonly isSubmitting: boolean;
  readonly open: (pathId: PlannerNodePathId) => void;
  readonly cancel: () => void;
  readonly change: (memo: string) => void;
  readonly save: () => Promise<void>;
};

// Activity 메모 편집 상태를 소유한다.
// 이름 편집과 달리 저장이 실패하면 초안을 유지하고 오류만 노출한다.
export function usePlannerMemoEditing(commands?: PlannerNodeEditingCommands): PlannerMemoEditing {
  const entityMap = usePlannerViewStore((state) => state.tree.entityMap);
  const [editingPathId, setEditingPathId] = useState<PlannerNodePathId | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const open = useCallback(
    (pathId: PlannerNodePathId): void => {
      const node = entityMap.get(pathId);
      if (node?.kind !== "activity") {
        return;
      }

      setEditingPathId(pathId);
      setDraft(node.memo ?? "");
      setError(null);
    },
    [entityMap],
  );

  const cancel = useCallback((): void => {
    setEditingPathId(null);
    setDraft("");
    setError(null);
  }, []);

  const save = useCallback(async (): Promise<void> => {
    const node = editingPathId ? entityMap.get(editingPathId) : undefined;
    if (!commands || node?.kind !== "activity") {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await commands.updateActivity({
        id: node.id,
        name: node.name,
        memo: draft.trim() || null,
      });
      cancel();
    } catch {
      setError(MEMO_SAVE_ERROR_MESSAGE);
    } finally {
      setIsSubmitting(false);
    }
  }, [cancel, commands, draft, editingPathId, entityMap]);

  return { editingPathId, draft, error, isSubmitting, open, cancel, change: setDraft, save };
}
