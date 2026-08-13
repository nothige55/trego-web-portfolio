import { Plus } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type {
  PlannerCreateNodeDraft,
  PlannerCreateNodeKind,
} from "@/features/planner/operations/planner-operations";
import type { PlannerNodePathId } from "@/features/planner/types/planner-node";

type PlannerNodeCreateDialogProps = {
  readonly onCreate: (draft: PlannerCreateNodeDraft) => Promise<void>;
  readonly rootPathId: PlannerNodePathId;
};

export function PlannerNodeCreateDialog({ onCreate, rootPathId }: PlannerNodeCreateDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [kind, setKind] = useState<PlannerCreateNodeKind>("day");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reset = (): void => {
    setName("");
    setError(null);
    setIsSubmitting(false);
  };
  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await onCreate({ kind, name, parentPathId: rootPathId });
      reset();
      setIsOpen(false);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : String(caughtError));
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(nextOpen) => {
        setIsOpen(nextOpen);
        if (!nextOpen) reset();
      }}
    >
      <DialogTrigger
        render={<Button type="button" variant="ghost" size="icon-xs" aria-label="일정 추가" />}
      >
        <Plus aria-hidden="true" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>일정 추가</DialogTitle>
          <DialogDescription>위시리스트 폴더 또는 날짜를 현재 여행에 추가합니다.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={(event) => void handleSubmit(event)}>
          <label className="grid gap-1.5 text-xs font-medium">
            종류
            <select
              aria-label="일정 종류"
              className="h-9 rounded-lg border bg-background px-3 text-sm"
              value={kind}
              onChange={(event) => setKind(event.target.value as PlannerCreateNodeKind)}
            >
              <option value="day">날짜</option>
              <option value="wish-folder">위시리스트 폴더</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-medium">
            이름
            <input
              autoFocus
              aria-label="새 일정 이름"
              className="h-9 rounded-lg border bg-background px-3 text-sm"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          {error ? (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "추가 중…" : "추가"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
