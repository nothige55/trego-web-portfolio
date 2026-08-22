import { format, parseISO } from "date-fns";
import { useState } from "react";
import type { DateRange } from "react-day-picker";

import {
  getPlannerDateRangeChangeSummary,
  type PlannerDateRangeChangeSummary,
  type PlannerDateRangeInput,
} from "@/features/planner/operations/planner-date-range";
import type { PlannerNode, PlannerNodePathId } from "@/features/planner/types/planner-node";
import type { PlannerProjectDetails } from "@/features/planner/types/planner-project";

function toRange(projectDetails: PlannerProjectDetails): DateRange {
  return {
    from: parseISO(projectDetails.startDate),
    to: parseISO(projectDetails.endDate),
  };
}

function toInput(range: DateRange): PlannerDateRangeInput | null {
  if (!range.from || !range.to) {
    return null;
  }

  return {
    startDate: format(range.from, "yyyy-MM-dd"),
    endDate: format(range.to, "yyyy-MM-dd"),
  };
}

export type PlannerDateRangeForm = {
  readonly canApply: boolean;
  readonly canConfirm: boolean;
  readonly error: string | null;
  readonly isConfirmationOpen: boolean;
  readonly isOpen: boolean;
  readonly isSubmitting: boolean;
  readonly pendingSummary: PlannerDateRangeChangeSummary | null;
  readonly selectedRange: DateRange;
  readonly apply: () => void;
  readonly closeConfirmation: () => void;
  readonly confirm: () => void;
  readonly selectRange: (range: DateRange | undefined) => void;
  readonly setOpen: (isOpen: boolean) => void;
};

// 기간 선택 popover의 상태를 소유한다.
// Day가 사라지는 변경만 확인 단계를 거치므로 적용 대기 입력을 따로 붙들고 있는다.
export function usePlannerDateRangeForm({
  nodes,
  onUpdate,
  orderedPathIds,
  projectDetails,
}: {
  readonly nodes: readonly PlannerNode[];
  readonly onUpdate: (input: PlannerDateRangeInput) => Promise<void>;
  readonly orderedPathIds: readonly PlannerNodePathId[];
  readonly projectDetails: PlannerProjectDetails;
}): PlannerDateRangeForm {
  const [isOpen, setIsOpen] = useState(false);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [selectedRange, setSelectedRange] = useState<DateRange>(() => toRange(projectDetails));
  const [pendingInput, setPendingInput] = useState<PlannerDateRangeInput | null>(null);
  const [pendingSummary, setPendingSummary] = useState<PlannerDateRangeChangeSummary | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = toInput(selectedRange);
  const summary = input ? getPlannerDateRangeChangeSummary(nodes, orderedPathIds, input) : null;
  const isUnchanged =
    input?.startDate === projectDetails.startDate.slice(0, 10) &&
    input.endDate === projectDetails.endDate.slice(0, 10);

  const setOpen = (open: boolean): void => {
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

  const closeConfirmation = (): void => {
    setIsConfirmationOpen(false);
    setPendingInput(null);
    setPendingSummary(null);
    setError(null);
  };

  return {
    apply: () => {
      if (!input) {
        return;
      }

      if (summary?.removedDayCount) {
        setPendingInput(input);
        setPendingSummary(summary);
        setIsOpen(false);
        setIsConfirmationOpen(true);
        return;
      }

      void submitUpdate(input);
    },
    canApply: Boolean(input) && !isUnchanged && !isSubmitting,
    canConfirm: Boolean(pendingInput) && !isSubmitting,
    closeConfirmation,
    confirm: () => {
      if (pendingInput) {
        void submitUpdate(pendingInput);
      }
    },
    error,
    isConfirmationOpen,
    isOpen,
    isSubmitting,
    pendingSummary,
    selectRange: (range) => {
      if (range) {
        setSelectedRange(range);
      }
      setError(null);
    },
    selectedRange,
    setOpen,
  };
}
