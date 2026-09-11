// Activity 행 아래에 붙는 메모 영역
// 메모가 없고 편집 중도 아니면 행 높이를 늘리지 않도록 아무것도 그리지 않음

import { Button } from "@/components/ui/button";
import type { PlannerMemoEditing } from "@/features/planner/hooks/use-planner-memo-editing";
import type { PlannerNodeEditingCommands } from "@/features/planner/types/planner-editing-commands";
import type { PlannerActivityNode } from "@/features/planner/types/planner-node";
import { cn } from "@/lib/utils";

export function PlannerActivityMemo({
  activity,
  indentation,
  editing,
  commands,
  className,
}: {
  readonly activity: PlannerActivityNode;
  readonly indentation: number;
  readonly editing: PlannerMemoEditing;
  readonly commands?: PlannerNodeEditingCommands;
  readonly className?: string;
}) {
  const isEditing = editing.editingPathId === activity.pathId;

  if (!activity.memo && !isEditing) {
    return null;
  }

  return (
    <div
      className={cn("border-l-2 border-transparent pr-2 pb-2", className)}
      style={{ paddingLeft: indentation + 44 }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {isEditing ? (
        <div className="space-y-1.5">
          <textarea
            autoFocus
            aria-label="Activity 메모"
            className="min-h-20 w-full resize-y rounded-md border bg-background px-2.5 py-2 text-xs leading-relaxed outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            disabled={editing.isSubmitting}
            value={editing.draft}
            onChange={(event) => editing.change(event.target.value)}
            onKeyDown={(event) => {
              event.stopPropagation();

              if (event.key === "Escape") {
                event.preventDefault();
                editing.cancel();
              } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void editing.save();
              }
            }}
          />
          {editing.error ? (
            <p className="text-xs text-destructive" role="alert">
              {editing.error}
            </p>
          ) : null}
          <div className="flex justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={editing.isSubmitting}
              onClick={editing.cancel}
            >
              취소
            </Button>
            <Button
              type="button"
              size="xs"
              disabled={editing.isSubmitting}
              onClick={() => void editing.save()}
            >
              {editing.isSubmitting ? "저장 중…" : "저장"}
            </Button>
          </div>
        </div>
      ) : commands ? (
        <button
          type="button"
          aria-label={`${activity.name} 메모 편집`}
          className="block w-full text-left text-xs leading-relaxed break-words whitespace-pre-wrap text-muted-foreground hover:text-foreground"
          onClick={() => commands.editActivityMemo?.(activity.pathId)}
        >
          {activity.memo}
        </button>
      ) : (
        <p className="text-xs leading-relaxed break-words whitespace-pre-wrap text-muted-foreground">
          {activity.memo}
        </p>
      )}
    </div>
  );
}
