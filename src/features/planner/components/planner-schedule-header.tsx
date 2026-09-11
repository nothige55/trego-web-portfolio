// 일정 패널 상단의 여행 정보 영역
// 기간 편집 권한이 없으면 같은 자리에 읽기 전용 기간 배지를 둠

import { PlannerDateRangePopover } from "@/features/planner/components/planner-date-range-popover";
import type { PlannerDateRangeInput } from "@/features/planner/operations/planner-date-range";
import { usePlannerViewStore } from "@/features/planner/stores/planner-view-store";
import type { PlannerProjectDetails } from "@/features/planner/types/planner-project";

export function PlannerScheduleHeader({
  projectDetails,
  onUpdateDateRange,
}: {
  readonly projectDetails: PlannerProjectDetails;
  readonly onUpdateDateRange?: (input: PlannerDateRangeInput) => Promise<void>;
}) {
  const nodes = usePlannerViewStore((state) => state.nodes);
  const flattenedItems = usePlannerViewStore((state) => state.tree.flattenedItems);

  return (
    <header className="border-b px-6 py-4">
      <p className="text-xs font-semibold tracking-wide text-brand">Trego Planner</p>
      <div className="mt-2 flex items-start justify-between gap-3">
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{projectDetails.title}</h1>
        {onUpdateDateRange ? (
          <PlannerDateRangePopover
            nodes={nodes}
            orderedPathIds={flattenedItems.map((node) => node.pathId)}
            projectDetails={projectDetails}
            onUpdate={onUpdateDateRange}
          />
        ) : (
          <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground tabular-nums">
            {projectDetails.startDate.slice(5, 10).replace("-", ".")} –{" "}
            {projectDetails.endDate.slice(5, 10).replace("-", ".")}
          </span>
        )}
      </div>
      <p className="mt-1 w-full text-xs text-muted-foreground">
        실시간으로 일정을 함께 편집합니다.
      </p>
    </header>
  );
}
