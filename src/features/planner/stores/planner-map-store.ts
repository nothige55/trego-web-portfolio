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
