import { describe, expect, it } from "vitest";

import { demoPlannerProject } from "@/features/planner/data/demo-planner";
import { buildPlannerTree } from "@/features/planner/utils/build-planner-tree";
import { getVisiblePlannerNodes } from "@/features/planner/utils/get-visible-planner-nodes";

// 접힌 노드 아래의 모든 깊이가 화면 목록에서 제외되는지 검증한다.
describe("getVisiblePlannerNodes", () => {
  const tree = buildPlannerTree(demoPlannerProject.nodes);

  it("hides every descendant of a collapsed branch", () => {
    const visibleItems = getVisiblePlannerNodes(
      tree.flattenedItems,
      new Set(["root"]),
      tree.childrenMap,
    );

    expect(visibleItems.map((item) => item.pathId)).toEqual([
      "root",
      "wish",
      "region-jeju",
      "region-seogwipo",
    ]);
  });

  it("shows descendants when their ancestors are expanded", () => {
    const visibleItems = getVisiblePlannerNodes(
      tree.flattenedItems,
      new Set(["root", "wish", "region-jeju", "day-one"]),
      tree.childrenMap,
    );

    expect(visibleItems.map((item) => item.pathId)).toEqual([
      "root",
      "wish",
      "wish-udo",
      "wish-arte-museum",
      "wish-hallasan",
      "region-jeju",
      "day-one",
      "day-one-airport",
      "day-one-iho",
      "day-one-aewol",
      "day-one-hyeopjae",
      "day-two",
      "day-three",
      "region-seogwipo",
    ]);
  });

  it("returns only the root when the root is collapsed", () => {
    const visibleItems = getVisiblePlannerNodes(tree.flattenedItems, new Set(), tree.childrenMap);

    expect(visibleItems.map((item) => item.pathId)).toEqual(["root"]);
  });
});
