import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { type ComponentProps, lazy, Suspense } from "react";
import type { Labels } from "react-day-picker";

import type { Calendar } from "@/components/ui/calendar";

// 달력은 react-day-picker까지 함께 들어와 초기 번들을 크게 만들므로 열릴 때만 내려받는다.
// 한국어 라벨과 로딩 문구도 여기에서 한 번만 정한다.
const LazyCalendarImpl = lazy(() =>
  import("@/components/ui/calendar").then((module) => ({ default: module.Calendar })),
);

const calendarLabels = {
  labelNav: () => "달력 이동",
  labelPrevious: () => "이전 달",
  labelNext: () => "다음 달",
  labelDayButton: (date) => format(date, "yyyy년 M월 d일 EEEE", { locale: ko }),
} satisfies Partial<Labels>;

export function LazyCalendar({
  fallbackClassName = "flex h-72 w-64 items-center justify-center text-muted-foreground",
  ...calendarProps
}: ComponentProps<typeof Calendar> & { readonly fallbackClassName?: string }) {
  return (
    <Suspense
      fallback={
        <div role="status" className={fallbackClassName}>
          달력을 불러오는 중
        </div>
      }
    >
      <LazyCalendarImpl
        locale={ko}
        labels={calendarLabels}
        showOutsideDays={false}
        {...calendarProps}
      />
    </Suspense>
  );
}
