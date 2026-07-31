import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { CalendarDays, ChevronDown, X } from "lucide-react";
import { lazy, Suspense, useId, useState } from "react";
import type { Labels } from "react-day-picker";

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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import type { CreateTripInput } from "../types";

type ManualTripDialogProps = {
  onCreateTrip: (trip: CreateTripInput) => void;
};

const Calendar = lazy(() =>
  import("@/components/ui/calendar").then((module) => ({ default: module.Calendar })),
);

const inputClassName =
  "h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition placeholder:text-muted-foreground focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/15 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20";

const dateButtonClassName =
  "h-11 w-full justify-between rounded-xl border-input bg-background px-3 font-normal text-foreground hover:bg-muted/60 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20";

function toDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateLabel(date: Date) {
  return format(date, "yyyy. M. d.", { locale: ko });
}

const calendarLabels = {
  labelNav: () => "달력 이동",
  labelPrevious: () => "이전 달",
  labelNext: () => "다음 달",
  labelDayButton: (date) => format(date, "yyyy년 M월 d일 EEEE", { locale: ko }),
} satisfies Partial<Labels>;

export function ManualTripDialog({ onCreateTrip }: ManualTripDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [isStartDateOpen, setIsStartDateOpen] = useState(false);
  const [isEndDateOpen, setIsEndDateOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const errorMessageId = useId();
  const titleInputId = useId();

  const resetForm = () => {
    setTitle("");
    setStartDate(undefined);
    setEndDate(undefined);
    setIsStartDateOpen(false);
    setIsEndDateOpen(false);
    setErrorMessage("");
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      resetForm();
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedTitle = title.trim();
    if (!trimmedTitle || !startDate || !endDate) {
      setErrorMessage("제목과 여행 날짜를 모두 입력해 주세요.");
      return;
    }

    if (startDate.getTime() > endDate.getTime()) {
      setErrorMessage("종료일은 시작일보다 빠를 수 없습니다.");
      return;
    }

    onCreateTrip({
      title: trimmedTitle,
      startDate: toDateValue(startDate),
      endDate: toDateValue(endDate),
    });
    setIsOpen(false);
    resetForm();
  };

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
          <label htmlFor={titleInputId} className="block space-y-2 text-sm font-medium">
            <span>여행 제목</span>
            <input
              id={titleInputId}
              autoFocus
              type="text"
              required
              value={title}
              aria-invalid={Boolean(errorMessage)}
              aria-describedby={errorMessage ? errorMessageId : undefined}
              className={inputClassName}
              placeholder="예: 제주에서 보내는 늦여름"
              onChange={(event) => {
                setTitle(event.target.value);
                setErrorMessage("");
              }}
            />
          </label>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">여행 날짜</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 text-sm text-muted-foreground">
                <span>시작일</span>
                <div>
                  <Popover open={isStartDateOpen} onOpenChange={setIsStartDateOpen}>
                    <PopoverTrigger
                      render={
                        <Button
                          type="button"
                          variant="outline"
                          aria-label={
                            startDate ? `시작일: ${formatDateLabel(startDate)}` : "시작일 선택"
                          }
                          aria-invalid={Boolean(errorMessage)}
                          aria-describedby={errorMessage ? errorMessageId : undefined}
                          className={dateButtonClassName}
                        />
                      }
                    >
                      <span className={startDate ? undefined : "text-muted-foreground"}>
                        {startDate ? formatDateLabel(startDate) : "날짜 선택"}
                      </span>
                      <ChevronDown aria-hidden="true" className="size-4 opacity-60" />
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-0">
                      <Suspense
                        fallback={
                          <div
                            role="status"
                            className="flex h-72 w-64 items-center justify-center text-muted-foreground"
                          >
                            달력을 불러오는 중
                          </div>
                        }
                      >
                        <Calendar
                          mode="single"
                          selected={startDate}
                          defaultMonth={startDate}
                          locale={ko}
                          labels={calendarLabels}
                          showOutsideDays={false}
                          onSelect={(date) => {
                            if (!date) {
                              return;
                            }

                            setStartDate(date);
                            if (endDate && date.getTime() > endDate.getTime()) {
                              setEndDate(undefined);
                            }
                            setErrorMessage("");
                            setIsStartDateOpen(false);
                          }}
                        />
                      </Suspense>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <span>종료일</span>
                <div>
                  <Popover open={isEndDateOpen} onOpenChange={setIsEndDateOpen}>
                    <PopoverTrigger
                      render={
                        <Button
                          type="button"
                          variant="outline"
                          aria-label={
                            endDate ? `종료일: ${formatDateLabel(endDate)}` : "종료일 선택"
                          }
                          aria-invalid={Boolean(errorMessage)}
                          aria-describedby={errorMessage ? errorMessageId : undefined}
                          className={dateButtonClassName}
                        />
                      }
                    >
                      <span className={endDate ? undefined : "text-muted-foreground"}>
                        {endDate ? formatDateLabel(endDate) : "날짜 선택"}
                      </span>
                      <ChevronDown aria-hidden="true" className="size-4 opacity-60" />
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-0">
                      <Suspense
                        fallback={
                          <div
                            role="status"
                            className="flex h-72 w-64 items-center justify-center text-muted-foreground"
                          >
                            달력을 불러오는 중
                          </div>
                        }
                      >
                        <Calendar
                          mode="single"
                          selected={endDate}
                          defaultMonth={endDate ?? startDate}
                          locale={ko}
                          labels={calendarLabels}
                          showOutsideDays={false}
                          disabled={startDate ? { before: startDate } : undefined}
                          onSelect={(date) => {
                            if (!date) {
                              return;
                            }

                            setEndDate(date);
                            setErrorMessage("");
                            setIsEndDateOpen(false);
                          }}
                        />
                      </Suspense>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
          </fieldset>

          {errorMessage ? (
            <p id={errorMessageId} role="alert" className="text-sm text-destructive">
              {errorMessage}
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
