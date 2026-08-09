import { afterEach, describe, expect, it } from "vitest";

import { usePlannerMapStore } from "@/features/planner/stores/planner-map-store";

describe("usePlannerMapStore", () => {
  afterEach(() => {
    usePlannerMapStore.getState().reset();
  });

  it("toggles individual Day visibility without mutating the previous set", () => {
    const initialIds = usePlannerMapStore.getState().hiddenDayIds;

    usePlannerMapStore.getState().toggleDayVisibility("day-one");

    expect(initialIds.size).toBe(0);
    expect(usePlannerMapStore.getState().hiddenDayIds).toEqual(new Set(["day-one"]));

    usePlannerMapStore.getState().toggleDayVisibility("day-one");
    expect(usePlannerMapStore.getState().hiddenDayIds.size).toBe(0);
  });

  it("resets visibility with a new empty set", () => {
    usePlannerMapStore.getState().toggleDayVisibility("day-one");
    const hiddenIds = usePlannerMapStore.getState().hiddenDayIds;

    usePlannerMapStore.getState().reset();

    expect(usePlannerMapStore.getState().hiddenDayIds.size).toBe(0);
    expect(usePlannerMapStore.getState().hiddenDayIds).not.toBe(hiddenIds);
  });
});
