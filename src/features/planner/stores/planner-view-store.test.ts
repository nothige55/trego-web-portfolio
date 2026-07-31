import { beforeEach, describe, expect, it } from "vitest";

import { demoPlannerProject } from "@/features/planner/data/demo-planner";
import { usePlannerViewStore } from "@/features/planner/stores/planner-view-store";

// 전역 Zustand 인스턴스가 테스트 사이에 상태를 공유하지 않도록 매 테스트 전에 reset한다.
describe("usePlannerViewStore", () => {
  beforeEach(() => {
    usePlannerViewStore.getState().reset();
  });

  it("loads the fixture with only the root expanded", () => {
    usePlannerViewStore.getState().load(demoPlannerProject.nodes);

    const state = usePlannerViewStore.getState();
    expect(state.rootPathId).toBe("root");
    expect([...state.expandedIds]).toEqual(["root"]);
    expect(state.tree.flattenedItems).toHaveLength(demoPlannerProject.nodes.length);
  });

  it("expands a branch and all of its ancestors", () => {
    const store = usePlannerViewStore.getState();
    store.load(demoPlannerProject.nodes);
    store.toggleExpanded("root");
    store.toggleExpanded("day-one");

    expect([...usePlannerViewStore.getState().expandedIds]).toEqual([
      "day-one",
      "region-jeju",
      "root",
    ]);
  });

  it("collapses every branch except the root", () => {
    const store = usePlannerViewStore.getState();
    store.load(demoPlannerProject.nodes);
    store.toggleExpanded("wish");
    store.toggleExpanded("day-one");
    store.collapseAll();

    expect([...usePlannerViewStore.getState().expandedIds]).toEqual(["root"]);
  });

  it("supports single and shift selection and clears both selections", () => {
    const store = usePlannerViewStore.getState();
    store.load(demoPlannerProject.nodes);
    store.selectItem("wish");
    store.selectItem("region-jeju", true);

    expect(usePlannerViewStore.getState().selectedItemId).toBe("wish");
    expect(usePlannerViewStore.getState().multiSelectedIds).toEqual(["wish", "region-jeju"]);
    expect(usePlannerViewStore.getState().selectionRangeIds).toEqual(["wish", "region-jeju"]);

    store.clearSelection();
    expect(usePlannerViewStore.getState().selectedItemId).toBeNull();
    expect(usePlannerViewStore.getState().multiSelectedIds).toEqual([]);
    expect(usePlannerViewStore.getState().selectionRangeIds).toEqual([]);
  });

  it("normalizes only the nodes visible between the shift-selection endpoints", () => {
    const store = usePlannerViewStore.getState();
    store.load(demoPlannerProject.nodes);
    store.toggleExpanded("region-jeju");
    store.toggleExpanded("day-one");
    store.toggleExpanded("day-two");
    store.toggleExpanded("day-three");
    store.selectItem("day-one");
    store.selectItem("day-three", true);

    const state = usePlannerViewStore.getState();
    expect(state.multiSelectedIds).toEqual(["region-jeju"]);
    expect(state.selectionRangeIds).toContain("day-two-bijarim");
    expect(state.selectionRangeIds).not.toContain("region-jeju");
  });

  it("switches modules and controls the module panel", () => {
    const store = usePlannerViewStore.getState();
    store.setModuleCollapsed(true);
    store.setActiveModule("chat");

    expect(usePlannerViewStore.getState().activeModule).toBe("chat");
    expect(usePlannerViewStore.getState().isModuleCollapsed).toBe(false);

    store.setModuleCollapsed(true);
    expect(usePlannerViewStore.getState().isModuleCollapsed).toBe(true);
  });
});
