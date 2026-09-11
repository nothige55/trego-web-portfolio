// 지도에서 숨긴 Day 집합만 소유. Day 행의 표시 토글과 지도 인스턴스 hook이 이 값을 공유

import { create } from "zustand";

import type { PlannerNodePathId } from "@/features/planner/types/planner-node";

type PlannerMapState = {
  readonly hiddenDayIds: ReadonlySet<PlannerNodePathId>;
};

type PlannerMapActions = {
  toggleDayVisibility: (dayPathId: PlannerNodePathId) => void;
  reset: () => void;
};

function createInitialState(): PlannerMapState {
  return { hiddenDayIds: new Set() };
}

export const usePlannerMapStore = create<PlannerMapState & PlannerMapActions>((set) => ({
  ...createInitialState(),
  toggleDayVisibility(dayPathId) {
    set((state) => {
      const hiddenDayIds = new Set(state.hiddenDayIds);

      if (hiddenDayIds.has(dayPathId)) {
        hiddenDayIds.delete(dayPathId);
      } else {
        hiddenDayIds.add(dayPathId);
      }

      return { hiddenDayIds };
    });
  },
  reset() {
    set(createInitialState());
  },
}));
