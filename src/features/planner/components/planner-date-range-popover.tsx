// 여행 기간 버튼과 달력 popover, 기간 축소 확인 dialog를 한 묶음으로 배치
// 입력과 확인 단계의 상태는 usePlannerDateRangeForm이 소유

import { format, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";

import { LazyCalendar } from "@/components/lazy-calendar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PlannerDateRangeConfirmDialog } from "@/features/planner/components/planner-date-range-confirm-dialog";
import { usePlannerDateRangeForm } from "@/features/planner/hooks/use-planner-date-range-form";
import type { PlannerDateRangeInput } from "@/features/planner/operations/planner-date-range";
import type { PlannerNode, PlannerNodePathId } from "@/features/planner/types/planner-node";
import type { PlannerProjectDetails } from "@/features/planner/types/planner-project";

type PlannerDateRangePopoverProps = {
  readonly nodes: readonly PlannerNode[];
  readonly onUpdate: (input: PlannerDateRangeInput) => Promise<void>;
  readonly orderedPathIds: readonly PlannerNodePathId[];
  readonly projectDetails: PlannerProjectDetails;
};

export function PlannerDateRangePopover({
  nodes,
  onUpdate,
  orderedPathIds,
  projectDetails,
}: PlannerDateRangePopoverProps) {
  const form = usePlannerDateRangeForm({ nodes, onUpdate, orderedPathIds, projectDetails });
  const label = `${format(parseISO(projectDetails.startDate), "MM.dd")} – ${format(
    parseISO(projectDetails.endDate),
    "MM.dd",
  )}`;

  return (
    <>
      <Popover open={form.isOpen} onOpenChange={form.setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="xs"
              aria-label={`여행 날짜: ${label}`}
              className="border-brand/25 bg-brand/10 text-brand tabular-nums hover:border-brand/35 hover:bg-brand/15 hover:text-brand aria-expanded:border-brand/40 aria-expanded:bg-brand/20 aria-expanded:text-brand"
            />
          }
        >
          <CalendarDays aria-hidden="true" />
          {label}
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 gap-0 overflow-hidden p-0">
          <LazyCalendar
            mode="range"
            selected={form.selectedRange}
            defaultMonth={form.selectedRange.from}
            fallbackClassName="flex h-72 w-64 items-center justify-center"
            className="w-full p-3 [--cell-size:2rem]"
            classNames={{
              day_button:
                "data-[range-start=true]:bg-brand data-[range-start=true]:text-white data-[range-end=true]:bg-brand data-[range-end=true]:text-white data-[range-middle=true]:bg-brand/10 data-[range-middle=true]:text-brand",
              range_start:
                "relative isolate z-0 rounded-l-(--cell-radius) bg-brand/10 after:absolute after:inset-y-0 after:right-0 after:w-4 after:bg-brand/10",
              range_middle: "rounded-none bg-brand/10",
              range_end:
                "relative isolate z-0 rounded-r-(--cell-radius) bg-brand/10 after:absolute after:inset-y-0 after:left-0 after:w-4 after:bg-brand/10",
            }}
            onSelect={form.selectRange}
          />
          <div className="border-t px-3 py-2.5">
            {form.error ? (
              <p role="alert" className="mb-2 text-xs text-destructive">
                {form.error}
              </p>
            ) : null}
            <div className="flex justify-end gap-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => form.setOpen(false)}>
                취소
              </Button>
              <Button type="button" size="sm" disabled={!form.canApply} onClick={form.apply}>
                {form.isSubmitting ? "변경 중…" : "적용"}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <PlannerDateRangeConfirmDialog
        canConfirm={form.canConfirm}
        error={form.error}
        isOpen={form.isConfirmationOpen}
        isSubmitting={form.isSubmitting}
        summary={form.pendingSummary}
        onCancel={form.closeConfirmation}
        onConfirm={form.confirm}
        onOpenChange={(open) => {
          if (!open) {
            form.closeConfirmation();
          }
        }}
      />
    </>
  );
}
