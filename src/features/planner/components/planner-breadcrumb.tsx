import { PlannerNodeLabel } from "@/features/planner/components/planner-node-label";
import type {
  FlattenedPlannerNode,
  PlannerNodePathId,
} from "@/features/planner/types/planner-node";

type PlannerBreadcrumbProps = {
  readonly ancestors: readonly FlattenedPlannerNode[];
  readonly dayNumberByPathId: ReadonlyMap<PlannerNodePathId, number>;
  readonly entityMap: ReadonlyMap<PlannerNodePathId, FlattenedPlannerNode>;
};

export const PLANNER_BREADCRUMB_HEIGHT = 32;

export function PlannerBreadcrumb({
  ancestors,
  dayNumberByPathId,
  entityMap,
}: PlannerBreadcrumbProps) {
  if (ancestors.length === 0) {
    // 일정 헤더가 이 공간을 덮는다. 항상 같은 높이를 유지해 breadcrumb 전환 시 목록이 흔들리지 않는다.
    return (
      <div
        aria-hidden="true"
        data-testid="planner-breadcrumb-placeholder"
        className="sticky -top-px z-40 h-8 w-full"
      />
    );
  }

  return (
    <nav
      aria-label="현재 일정 경로"
      className="pointer-events-none sticky top-8 z-40 flex h-8 w-full items-center gap-1 overflow-hidden bg-card pr-5 pl-[22px] after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-border after:content-['']"
    >
      {ancestors.map((ancestor, index) => (
        <div key={ancestor.pathId} className="flex min-w-0 shrink-0 items-center gap-1">
          <PlannerNodeLabel
            node={ancestor}
            parent={ancestor.parentPathId ? entityMap.get(ancestor.parentPathId) : undefined}
            dayNumber={dayNumberByPathId.get(ancestor.pathId)}
            titleClassName="max-w-24"
          />
          {index < ancestors.length - 1 ? (
            <span aria-hidden="true" className="text-sm leading-none text-muted-foreground">
              /
            </span>
          ) : null}
        </div>
      ))}
    </nav>
  );
}
