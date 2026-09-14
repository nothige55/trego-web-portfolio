// 목록의 스크롤 위치에 의존하는 두 가지 부수효과를 함께 소유
// 하나는 선택 행을 보이는 영역으로 끌어오는 것, 다른 하나는 breadcrumb 기준 행을 정하는 것

import { useCallback, useLayoutEffect, useRef, useState } from "react";

import {
  PLANNER_BREADCRUMB_HEIGHT,
  PLANNER_BREADCRUMB_TOP,
} from "@/features/planner/components/planner-breadcrumb";
import { usePlannerViewStore } from "@/features/planner/stores/planner-view-store";
import type {
  FlattenedPlannerNode,
  PlannerNodePathId,
} from "@/features/planner/types/planner-node";

export type PlannerScheduleScroll = {
  readonly scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  // breadcrumb 아랫변을 지난 마지막 행. breadcrumb에는 이 행의 조상을 표시하고,
  // 이 행이 다음 최상위 구간이면 바로 앞 행에 이전 구간의 라벨을 붙임
  readonly topItemId: PlannerNodePathId | null;
  readonly updateTopItem: () => void;
};

export function usePlannerScheduleScroll({
  items,
  getItemElement,
}: {
  readonly items: readonly FlattenedPlannerNode[];
  readonly getItemElement: (pathId: PlannerNodePathId) => HTMLElement | null;
}): PlannerScheduleScroll {
  const selectedItemId = usePlannerViewStore((state) => state.selectedItemId);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [topItemId, setTopItemId] = useState<PlannerNodePathId | null>(null);

  useLayoutEffect(() => {
    if (!selectedItemId) {
      return;
    }

    const selectedElement = getItemElement(selectedItemId);
    if (typeof selectedElement?.scrollIntoView === "function") {
      selectedElement.scrollIntoView({ block: "nearest" });
    }
  }, [getItemElement, items, selectedItemId]);

  const updateTopItem = useCallback((): void => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) {
      return;
    }

    const breadcrumbBottom =
      scrollContainer.getBoundingClientRect().top +
      PLANNER_BREADCRUMB_TOP +
      PLANNER_BREADCRUMB_HEIGHT;
    let nextTopItemId: PlannerNodePathId | null = null;

    // 행 라벨은 breadcrumb 아래로 완전히 들어가는 순간 사라짐
    // 그 순간 다음 행이 breadcrumb 아랫변에 닿으므로, 그 행의 조상을 보여 주면
    // 사라진 라벨이 곧바로 breadcrumb에 나타남. 선이 고정이라 breadcrumb 노출 여부로 흔들리지 않음
    for (const item of items) {
      const element = getItemElement(item.pathId);
      const top = element?.getBoundingClientRect().top;
      if (top === undefined || top > breadcrumbBottom) {
        break;
      }
      nextTopItemId = item.pathId;
    }

    setTopItemId((current) => (current === nextTopItemId ? current : nextTopItemId));
  }, [getItemElement, items]);

  useLayoutEffect(() => {
    updateTopItem();
  }, [updateTopItem]);

  return { scrollContainerRef, topItemId, updateTopItem };
}
