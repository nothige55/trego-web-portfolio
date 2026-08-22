import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { ChevronDown } from "lucide-react";
import type { Matcher } from "react-day-picker";

import { LazyCalendar } from "@/components/lazy-calendar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const dateButtonClassName =
  "h-11 w-full justify-between rounded-xl border-input bg-background px-3 font-normal text-foreground hover:bg-muted/60 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20";

function formatDateLabel(date: Date): string {
  return format(date, "yyyy. M. d.", { locale: ko });
}

// 시작일·종료일 칸은 선택 규칙만 다르고 생김새가 같아 한 컴포넌트로 둔다.
export function ManualTripDateField({
  label,
  value,
  defaultMonth,
  describedById,
  disabledDates,
  isInvalid,
  isOpen,
  onOpenChange,
  onSelect,
}: {
  readonly label: string;
  readonly value?: Date;
  readonly defaultMonth?: Date;
  readonly describedById?: string;
  readonly disabledDates?: Matcher;
  readonly isInvalid: boolean;
  readonly isOpen: boolean;
  readonly onOpenChange: (isOpen: boolean) => void;
  readonly onSelect: (date: Date) => void;
}) {
  return (
    <div className="space-y-2 text-sm text-muted-foreground">
      <span>{label}</span>
      <div>
        <Popover open={isOpen} onOpenChange={onOpenChange}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="outline"
                aria-label={value ? `${label}: ${formatDateLabel(value)}` : `${label} 선택`}
                aria-invalid={isInvalid}
                aria-describedby={describedById}
                className={dateButtonClassName}
              />
            }
          >
            <span className={value ? undefined : "text-muted-foreground"}>
              {value ? formatDateLabel(value) : "날짜 선택"}
            </span>
            <ChevronDown aria-hidden="true" className="size-4 opacity-60" />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <LazyCalendar
              mode="single"
              selected={value}
              defaultMonth={defaultMonth}
              disabled={disabledDates}
              onSelect={(date) => {
                if (!date) {
                  return;
                }

                onSelect(date);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
