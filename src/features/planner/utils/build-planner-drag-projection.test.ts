import { describe, expect, it } from "vitest";

import { demoPlannerProject } from "@/features/planner/data/demo-planner";
import { buildPlannerDragProjection } from "@/features/planner/utils/build-planner-drag-projection";
import { buildPlannerTree } from "@/features/planner/utils/build-planner-tree";

describe("buildPlannerDragProjection", () => {
  const tree = buildPlannerTree(demoPlannerProject.nodes);
  const namesOf = (
    projection: ReturnType<typeof buildPlannerDragProjection>,
    parentPathId: string,
  ) => (projection?.childrenMap.get(parentPathId) ?? []).map((node) => node.pathId);

  it("returns nothing while no node is held", () => {
    expect(buildPlannerDragProjection({ tree, activePathId: null, destination: null })).toBeNull();
  });

  it("closes the list over the held node when it has nowhere to land", () => {
    const projection = buildPlannerDragProjection({
      tree,
      activePathId: "day-one-iho",
      destination: null,
    });

    expect(namesOf(projection, "day-one")).toEqual([
      "day-one-airport",
      "day-one-aewol",
      "day-one-hyeopjae",
    ]);
    expect(projection?.parentPathId).toBeNull();
  });

  it("puts the held node back at the position it would drop into", () => {
    const projection = buildPlannerDragProjection({
      tree,
      activePathId: "day-one-iho",
      destination: { parentPathId: "day-one", siblingIndex: 3 },
    });

    expect(namesOf(projection, "day-one")).toEqual([
      "day-one-airport",
      "day-one-aewol",
      "day-one-hyeopjae",
      "day-one-iho",
    ]);
    expect(projection?.parentPathId).toBe("day-one");
  });

  it("moves the held node between parents", () => {
    const projection = buildPlannerDragProjection({
      tree,
      activePathId: "day-one-iho",
      destination: { parentPathId: "day-two", siblingIndex: 0 },
    });

    expect(namesOf(projection, "day-one")).toEqual([
      "day-one-airport",
      "day-one-aewol",
      "day-one-hyeopjae",
    ]);
    expect(namesOf(projection, "day-two")[0]).toBe("day-one-iho");
  });

  // 목적지 index는 규칙 계산이 낸 값이지만 드래그 중 트리와 어긋날 수 있다.
  it("clamps a sibling index that the current tree cannot hold", () => {
    const projection = buildPlannerDragProjection({
      tree,
      activePathId: "day-one-iho",
      destination: { parentPathId: "day-one", siblingIndex: 99 },
    });

    expect(namesOf(projection, "day-one").at(-1)).toBe("day-one-iho");
  });

  it("leaves untouched parents sharing the original arrays", () => {
    const projection = buildPlannerDragProjection({
      tree,
      activePathId: "day-one-iho",
      destination: { parentPathId: "day-one", siblingIndex: 0 },
    });

    expect(projection?.childrenMap.get("day-two")).toBe(tree.childrenMap.get("day-two"));
  });
});
