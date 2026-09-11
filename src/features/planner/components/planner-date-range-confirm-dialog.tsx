// 기간을 줄이면 뒤쪽 Day와 그 안의 일정이 사라지므로 적용 전에 규모를 알림

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PlannerDateRangeChangeSummary } from "@/features/planner/operations/planner-date-range";

export function PlannerDateRangeConfirmDialog({
  canConfirm,
  error,
  isOpen,
  isSubmitting,
  summary,
  onCancel,
  onConfirm,
  onOpenChange,
}: {
  readonly error: string | null;
  readonly isOpen: boolean;
  readonly canConfirm: boolean;
  readonly isSubmitting: boolean;
  readonly summary: PlannerDateRangeChangeSummary | null;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  readonly onOpenChange: (isOpen: boolean) => void;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>여행 기간을 줄일까요?</DialogTitle>
          <DialogDescription>
            {`뒤쪽 날짜 ${summary?.removedDayCount ?? 0}개${
              summary?.removedActivityCount
                ? `와 포함된 일정 ${summary.removedActivityCount}개`
                : ""
            }가 Planner에서 삭제됩니다.`}
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            취소
          </Button>
          <Button type="button" variant="destructive" disabled={!canConfirm} onClick={onConfirm}>
            {isSubmitting ? "변경 중…" : "삭제 후 적용"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
