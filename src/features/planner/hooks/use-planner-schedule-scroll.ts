import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { PLANNER_BREADCRUMB_HEIGHT } from "@/features/planner/components/planner-breadcrumb";
import { usePlannerViewStore } from "@/features/planner/stores/planner-view-store";
import type {
  FlattenedPlannerNode,
  PlannerNodePathId,
} from "@/features/planner/types/planner-node";

export type PlannerScheduleScroll = {
  readonly scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  readonly topItemId: PlannerNodePathId | null;
  readonly updateTopItem: () => void;
};

// 목록의 스크롤 위치에 의존하는 두 가지 부수효과를 함께 소유한다.
// 하나는 선택 행을 보이는 영역으로 끌어오는 것, 다른 하나는 breadcrumb 기준 행을 정하는 것이다.
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

    const threshold = scrollContainer.getBoundingClientRect().top + PLANNER_BREADCRUMB_HEIGHT;
    let nextTopItemId: PlannerNodePathId | null = null;

    // breadcrumb 영역을 지난 마지막 노드를 현재 행으로 삼고, breadcrumb에는 그 조상만 표시한다.
    for (const item of items) {
      const element = getItemElement(item.pathId);
      if (!element || element.getBoundingClientRect().top > threshold) {
        break;
      }
      nextTopItemId = item.pathId;
    }

    setTopItemId((currentTopItemId) =>
      currentTopItemId === nextTopItemId ? currentTopItemId : nextTopItemId,
    );
  }, [getItemElement, items]);

  useLayoutEffect(() => {
    updateTopItem();
  }, [updateTopItem]);

  return { scrollContainerRef, topItemId, updateTopItem };
}
