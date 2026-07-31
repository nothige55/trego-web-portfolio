import { describe, expect, it } from "vitest";

import { demoPlannerProject } from "@/features/planner/data/demo-planner";
import { buildPlannerTree } from "@/features/planner/utils/build-planner-tree";
import {
  calculateShiftSelection,
  getShiftSelectionRange,
} from "@/features/planner/utils/calculate-shift-selection";

// 기존 Planner에서 중요한 양방향 범위 및 부모-자손 정규화 규칙을 회귀 테스트로 고정한다.
describe("calculateShiftSelection", () => {
  const tree = buildPlannerTree(demoPlannerProject.nodes);

  function selectBetween(currentPathId: string, lastPathId: string) {
    const currentItem = tree.entityMap.get(currentPathId);
    const lastSelectedItem = tree.entityMap.get(lastPathId);

    if (!currentItem || !lastSelectedItem) {
      throw new Error("Test node was not found");
    }

    return calculateShiftSelection({
      flattenedItems: tree.flattenedItems,
      currentItem,
      lastSelectedItem,
      childrenMap: tree.childrenMap,
      entityMap: tree.entityMap,
    }).map((item) => item.pathId);
  }

  it("normalizes a descendant-only range to its highest selected parent", () => {
    expect(selectBetween("wish-hallasan", "wish")).toEqual(["wish"]);
  });

  it("selects top-level siblings without duplicating their descendants", () => {
    expect(selectBetween("region-jeju", "wish")).toEqual(["wish", "region-jeju"]);
  });

  it("returns the same normalized range when selecting backwards", () => {
    expect(selectBetween("wish", "region-jeju")).toEqual(["wish", "region-jeju"]);
  });

  it("keeps a partial descendant and the following complete branch", () => {
    expect(selectBetween("region-jeju", "wish-hallasan")).toEqual(["wish-hallasan", "region-jeju"]);
  });

  it("promotes every selected activity to its day even when the day is outside the range", () => {
    expect(selectBetween("day-two-sehwa", "day-two-bijarim")).toEqual(["day-two"]);
  });

  it("promotes every selected day to its region even when the region is outside the range", () => {
    expect(selectBetween("day-three", "day-one")).toEqual(["region-jeju"]);
  });

  it("does not promote a partially covered following region", () => {
    expect(selectBetween("day-six", "day-one")).toEqual([
      "region-jeju",
      "day-four",
      "day-five",
      "day-six",
    ]);
  });

  it("normalizes complete branches identically in reverse", () => {
    expect(selectBetween("day-one", "day-six")).toEqual([
      "region-jeju",
      "day-four",
      "day-five",
      "day-six",
    ]);
  });

  it("keeps every intermediate node in the visual shift range", () => {
    const currentItem = tree.entityMap.get("day-six");
    const lastSelectedItem = tree.entityMap.get("day-one");

    if (!currentItem || !lastSelectedItem) {
      throw new Error("Test node was not found");
    }

    const rangeIds = getShiftSelectionRange(tree.flattenedItems, currentItem, lastSelectedItem).map(
      (item) => item.pathId,
    );

    expect(rangeIds).toContain("day-two-bijarim");
    expect(rangeIds).toContain("region-seogwipo");
    expect(rangeIds).not.toContain("day-seven");
  });
});
