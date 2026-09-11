// 제목과 여행 기간을 받아 새 여행을 만드는 다이얼로그
// 입력 상태와 검증은 useManualTripForm에 맡기고, 여기서는 열림 상태와 제출 흐름만 다룸

import { CalendarDays, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ManualTripDateField } from "@/features/home/components/manual-trip-date-field";
import { useManualTripForm } from "@/features/home/hooks/use-manual-trip-form";

import type { CreateTripInput } from "../types";

type ManualTripDialogProps = {
  onCreateTrip: (trip: CreateTripInput) => void;
};

const inputClassName =
  "h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition placeholder:text-muted-foreground focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/15 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20";

export function ManualTripDialog({ onCreateTrip }: ManualTripDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const form = useManualTripForm();

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      form.reset();
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trip = form.submit();
    if (!trip) {
      return;
    }

    onCreateTrip(trip);
    setIsOpen(false);
    form.reset();
  };

  const describedById = form.errorMessage ? form.errorMessageId : undefined;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-full border-brand/20 bg-background px-4 text-sm text-foreground shadow-sm hover:bg-brand/5 hover:text-brand"
          />
        }
      >
        <CalendarDays aria-hidden="true" />
        직접 여행 만들기
      </DialogTrigger>

      <DialogContent showCloseButton={false} className="gap-0 rounded-3xl p-5 sm:max-w-md sm:p-6">
        <DialogHeader className="pr-10">
          <DialogTitle className="text-xl font-semibold tracking-tight">새 여행 만들기</DialogTitle>
          <DialogDescription>여행 제목과 날짜를 먼저 정해두세요.</DialogDescription>
        </DialogHeader>
        <DialogClose
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4"
              aria-label="여행 만들기 닫기"
            />
          }
        >
          <X aria-hidden="true" />
        </DialogClose>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit} noValidate>
          <label htmlFor={form.titleInputId} className="block space-y-2 text-sm font-medium">
            <span>여행 제목</span>
            <input
              id={form.titleInputId}
              autoFocus
              type="text"
              required
              value={form.title}
              aria-invalid={Boolean(form.errorMessage)}
              aria-describedby={describedById}
              className={inputClassName}
              placeholder="예: 제주에서 보내는 늦여름"
              onChange={(event) => form.changeTitle(event.target.value)}
            />
          </label>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">여행 날짜</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <ManualTripDateField
                label="시작일"
                value={form.startDate}
                defaultMonth={form.startDate}
                describedById={describedById}
                isInvalid={Boolean(form.errorMessage)}
                isOpen={form.isStartDateOpen}
                onOpenChange={form.setStartDateOpen}
                onSelect={form.selectStartDate}
              />
              <ManualTripDateField
                label="종료일"
                value={form.endDate}
                defaultMonth={form.endDate ?? form.startDate}
                describedById={describedById}
                disabledDates={form.startDate ? { before: form.startDate } : undefined}
                isInvalid={Boolean(form.errorMessage)}
                isOpen={form.isEndDateOpen}
                onOpenChange={form.setEndDateOpen}
                onSelect={form.selectEndDate}
              />
            </div>
          </fieldset>

          {form.errorMessage ? (
            <p id={form.errorMessageId} role="alert" className="text-sm text-destructive">
              {form.errorMessage}
            </p>
          ) : null}

          <DialogFooter className="-mx-5 mt-6 -mb-5 rounded-b-3xl px-5 py-4 sm:-mx-6 sm:-mb-6 sm:px-6">
            <DialogClose render={<Button type="button" variant="outline" className="h-10 px-4" />}>
              취소
            </DialogClose>
            <Button
              type="submit"
              className="h-10 bg-brand px-4 text-brand-foreground hover:bg-brand-hover"
            >
              여행 만들기
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
