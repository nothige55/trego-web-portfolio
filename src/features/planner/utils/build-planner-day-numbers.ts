// Day 행에 표시할 달력 날짜를 계산
// 서버는 Day에 날짜를 담지 않으므로 프로젝트 시작일에서 트리 순서만큼 더해 유도

import type {
  FlattenedPlannerNode,
  PlannerNodePathId,
} from "@/features/planner/types/planner-node";

const FALLBACK_START_DATE = "1970-01-01";

export function buildPlannerDayNumbers(
  items: readonly FlattenedPlannerNode[],
  projectStartDate?: string,
): ReadonlyMap<PlannerNodePathId, number> {
  const startDateValue = projectStartDate?.slice(0, 10) ?? FALLBACK_START_DATE;
  const startDate = new Date(`${startDateValue}T00:00:00Z`);
  const dayNumbers = new Map<PlannerNodePathId, number>();
  let dayOffset = 0;

  items.forEach((node) => {
    if (node.kind !== "day") {
      return;
    }

    const date = new Date(startDate);
    date.setUTCDate(startDate.getUTCDate() + dayOffset);
    dayNumbers.set(node.pathId, date.getUTCDate());
    dayOffset += 1;
  });

  return dayNumbers;
}
