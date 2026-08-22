import { describe, expect, it } from "vitest";

import { demoPlannerProject } from "@/features/planner/data/demo-planner";
import { buildPlannerDayNumbers } from "@/features/planner/utils/build-planner-day-numbers";
import { buildPlannerTree } from "@/features/planner/utils/build-planner-tree";

// Day 번호는 서버가 주지 않고 시작일 + 트리 순서로만 유도된다는 규칙을 고정한다.
describe("buildPlannerDayNumbers", () => {
  const tree = buildPlannerTree(demoPlannerProject.nodes);

  it("counts calendar dates forward from the project start date", () => {
    const dayNumbers = buildPlannerDayNumbers(tree.flattenedItems, "2026-03-30T00:00:00Z");

    expect(dayNumbers.get("day-one")).toBe(30);
    expect(dayNumbers.get("day-two")).toBe(31);
    expect(dayNumbers.get("day-three")).toBe(1);
  });

  it("numbers only Day nodes", () => {
    const dayNumbers = buildPlannerDayNumbers(tree.flattenedItems, "2026-03-30T00:00:00Z");

    expect(dayNumbers.has("wish")).toBe(false);
    expect(dayNumbers.has("day-one-airport")).toBe(false);
  });
});
