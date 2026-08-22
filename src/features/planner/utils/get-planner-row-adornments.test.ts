import { describe, expect, it } from "vitest";

import { demoPlannerProject } from "@/features/planner/data/demo-planner";
import { buildPlannerTree } from "@/features/planner/utils/build-planner-tree";
import { getPlannerRowAdornments } from "@/features/planner/utils/get-planner-row-adornments";

describe("getPlannerRowAdornments", () => {
  const tree = buildPlannerTree(demoPlannerProject.nodes);
  const nodeOf = (pathId: string) => tree.entityMap.get(pathId)!;

  it("links an Activity to the Activity scheduled before it in the same Day", () => {
    const { previousActivity } = getPlannerRowAdornments({
      node: nodeOf("day-one-iho"),
      tree,
      rootPathId: "root",
      topItemId: null,
      isDragging: false,
    });

    expect(previousActivity?.pathId).toBe("day-one-airport");
  });

  it("leaves the first Activity of a Day without a route origin", () => {
    const { previousActivity } = getPlannerRowAdornments({
      node: nodeOf("day-one-airport"),
      tree,
      rootPathId: "root",
      topItemId: null,
      isDragging: false,
    });

    expect(previousActivity).toBeUndefined();
  });

  it("shows the top ancestor while the last row of a branch scrolls past", () => {
    const { boundaryAncestor } = getPlannerRowAdornments({
      node: nodeOf("day-three-dongmun"),
      nextNode: nodeOf("region-seogwipo"),
      tree,
      rootPathId: "root",
      topItemId: "day-three-dongmun",
      isDragging: false,
    });

    expect(boundaryAncestor?.pathId).toBe("region-jeju");
  });

  it("hides the boundary label while a node is being dragged", () => {
    const { boundaryAncestor } = getPlannerRowAdornments({
      node: nodeOf("day-three-dongmun"),
      nextNode: nodeOf("region-seogwipo"),
      tree,
      rootPathId: "root",
      topItemId: "day-three-dongmun",
      isDragging: true,
    });

    expect(boundaryAncestor).toBeUndefined();
  });
});
