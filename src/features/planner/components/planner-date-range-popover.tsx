import { format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import type { DateRange, Labels } from "react-day-picker";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  getPlannerDateRangeChangeSummary,
  type PlannerDateRangeChangeSummary,
  type PlannerDateRangeInput,
} from "@/features/planner/operations/planner-date-range";
import type { PlannerNode, PlannerNodePathId } from "@/features/planner/types/planner-node";
import type { PlannerProjectDetails } from "@/features/planner/types/planner-project";

const Calendar = lazy(() =>
  import("@/components/ui/calendar").then((module) => ({ default: module.Calendar })),
);

const calendarLabels = {
  labelNav: () => "달력 이동",
  labelPrevious: () => "이전 달",
  labelNext: () => "다음 달",
  labelDayButton: (date) => format(date, "yyyy년 M월 d일 EEEE", { locale: ko }),
} satisfies Partial<Labels>;

type PlannerDateRangePopoverProps = {
  readonly nodes: readonly PlannerNode[];
  readonly onUpdate: (input: PlannerDateRangeInput) => Promise<void>;
  readonly orderedPathIds: readonly PlannerNodePathId[];
  readonly projectDetails: PlannerProjectDetails;
};

function toRange(projectDetails: PlannerProjectDetails): DateRange {
  return {
    from: parseISO(projectDetails.startDate),
    to: parseISO(projectDetails.endDate),
  };
}

function toInput(range: DateRange): PlannerDateRangeInput | null {
  if (!range.from || !range.to) return null;
  return {
    startDate: format(range.from, "yyyy-MM-dd"),
    endDate: format(range.to, "yyyy-MM-dd"),
  };
}

export function PlannerDateRangePopover({
  nodes,
  onUpdate,
  orderedPathIds,
  projectDetails,
}: PlannerDateRangePopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [selectedRange, setSelectedRange] = useState<DateRange>(() => toRange(projectDetails));
  const [pendingInput, setPendingInput] = useState<PlannerDateRangeInput | null>(null);
  const [pendingSummary, setPendingSummary] = useState<PlannerDateRangeChangeSummary | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = toInput(selectedRange);
  const summary = input ? getPlannerDateRangeChangeSummary(nodes, orderedPathIds, input) : null;
  const label = `${format(parseISO(projectDetails.startDate), "MM.dd")} – ${format(
    parseISO(projectDetails.endDate),
    "MM.dd",
  )}`;
  const isUnchanged =
    input?.startDate === projectDetails.startDate.slice(0, 10) &&
    input.endDate === projectDetails.endDate.slice(0, 10);

  const handleOpenChange = (open: boolean): void => {
    setIsOpen(open);
    if (open) {
      setSelectedRange(toRange(projectDetails));
      setError(null);
    }
  };
  const submitUpdate = async (nextInput: PlannerDateRangeInput): Promise<void> => {
    setIsSubmitting(true);
    setError(null);
    try {
      await onUpdate(nextInput);
      setIsOpen(false);
      setIsConfirmationOpen(false);
      setPendingInput(null);
      setPendingSummary(null);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : String(caughtError));
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleApply = (): void => {
    if (!input) return;
    if (summary?.removedDayCount) {
      setPendingInput(input);
      setPendingSummary(summary);
      setIsOpen(false);
      setIsConfirmationOpen(true);
      return;
    }
    void submitUpdate(input);
  };

  return (
    <>
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
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
          <Suspense
            fallback={
              <div role="status" className="flex h-72 w-64 items-center justify-center">
                달력을 불러오는 중
              </div>
            }
          >
            <Calendar
              mode="range"
              selected={selectedRange}
              defaultMonth={selectedRange.from}
              locale={ko}
              labels={calendarLabels}
              showOutsideDays={false}
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
              onSelect={(range) => {
                if (range) setSelectedRange(range);
                setError(null);
              }}
            />
          </Suspense>
          <div className="border-t px-3 py-2.5">
            {error ? (
              <p role="alert" className="mb-2 text-xs text-destructive">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
                취소
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!input || isUnchanged || isSubmitting}
                onClick={handleApply}
              >
                {isSubmitting ? "변경 중…" : "적용"}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <Dialog
        open={isConfirmationOpen}
        onOpenChange={(open) => {
          setIsConfirmationOpen(open);
          if (!open) {
            setPendingInput(null);
            setPendingSummary(null);
            setError(null);
          }
        }}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>여행 기간을 줄일까요?</DialogTitle>
            <DialogDescription>
              {`뒤쪽 날짜 ${pendingSummary?.removedDayCount ?? 0}개${
                pendingSummary?.removedActivityCount
                  ? `와 포함된 일정 ${pendingSummary.removedActivityCount}개`
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
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsConfirmationOpen(false);
                setPendingInput(null);
                setPendingSummary(null);
                setError(null);
              }}
            >
              취소
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!pendingInput || isSubmitting}
              onClick={() => {
                if (pendingInput) void submitUpdate(pendingInput);
              }}
            >
              {isSubmitting ? "변경 중…" : "삭제 후 적용"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
