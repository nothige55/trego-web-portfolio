import { afterEach, describe, expect, it } from "vitest";

import { usePlannerHistoryStore } from "@/features/planner/stores/planner-history-store";

const entry = {
  label: "일정 이동",
  redo: [{ type: "delete-node" as const, input: { pathId: "one" } }],
  undo: [],
};

describe("planner history store", () => {
  afterEach(() => usePlannerHistoryStore.getState().clear());

  it("moves entries between undo and redo stacks", () => {
    const store = usePlannerHistoryStore.getState();
    store.push(entry);

    expect(usePlannerHistoryStore.getState().takeUndo()).toBe(entry);
    expect(usePlannerHistoryStore.getState().isReplaying).toBe(true);
    usePlannerHistoryStore.getState().finishReplay();
    expect(usePlannerHistoryStore.getState().takeRedo()).toBe(entry);
  });

  it("clears redo entries after a new operation", () => {
    const store = usePlannerHistoryStore.getState();
    store.push(entry);
    store.takeUndo();
    store.finishReplay();
    store.push({ ...entry, label: "새 작업" });

    expect(usePlannerHistoryStore.getState().future).toEqual([]);
  });
});
