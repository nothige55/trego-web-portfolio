import { describe, expect, it } from "vitest";

import { demoPlannerProject } from "@/features/planner/data/demo-planner";
import { buildPlannerDragProjection } from "@/features/planner/utils/build-planner-drag-projection";
import { buildPlannerTree } from "@/features/planner/utils/build-planner-tree";
import { getPlannerRowAdornments } from "@/features/planner/utils/get-planner-row-adornments";

describe("getPlannerRowAdornments", () => {
  const tree = buildPlannerTree(demoPlannerProject.nodes);
  const nodeOf = (pathId: string) => tree.entityMap.get(pathId)!;

  const slotOf = (pathId: string, projection?: ReturnType<typeof buildPlannerDragProjection>) =>
    getPlannerRowAdornments({
      node: nodeOf(pathId),
      tree,
      rootPathId: "root",
      topItemId: null,
      isDragging: projection !== undefined,
      projection,
    }).hasRouteSlot;

  it("gives a route slot only to places that actually draw one", () => {
    expect(slotOf("day-one-iho")).toBe(true);
    // Day의 첫 장소는 앞 구간이 없고, Day 밑이 아닌 장소와 Day 자체도 구간이 생기지 않는다.
    expect(slotOf("day-one-airport")).toBe(false);
    expect(slotOf("wish-udo")).toBe(false);
    expect(slotOf("day-one")).toBe(false);
  });

  // 자리가 드래그 도중 생기거나 사라지면 행 높이가 달라져 dnd-kit의 이동량과 어긋난다.
  // 그래서 자리 유무만은 투영이 아니라 트리로 정한다.
  it("keeps the slot while the place it points at is being dragged away", () => {
    const projection = buildPlannerDragProjection({
      tree,
      activePathId: "day-one-airport",
      destination: null,
    });

    // 앞 장소가 사라져 값은 없어지지만 자리는 남는다.
    expect(slotOf("day-one-iho", projection)).toBe(true);
    expect(
      getPlannerRowAdornments({
        node: nodeOf("day-one-iho"),
        tree,
        rootPathId: "root",
        topItemId: null,
        isDragging: true,
        projection,
      }).previousActivity,
    ).toBeUndefined();
  });

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

  it("reads the route origin from the projection while dragging", () => {
    const projection = buildPlannerDragProjection({
      tree,
      activePathId: "day-one-iho",
      destination: null,
    });
    const { previousActivity } = getPlannerRowAdornments({
      node: nodeOf("day-one-aewol"),
      tree,
      rootPathId: "root",
      topItemId: null,
      isDragging: true,
      projection,
    });

    expect(previousActivity?.pathId).toBe("day-one-airport");
  });

  // 잡은 노드의 parentPathId는 아직 옛 부모라 투영된 부모로 갈아 끼워야 한다.
  it("gives the held node the neighbours of its destination Day", () => {
    const projection = buildPlannerDragProjection({
      tree,
      activePathId: "day-one-iho",
      destination: { parentPathId: "day-two", siblingIndex: 1 },
    });
    const { previousActivity } = getPlannerRowAdornments({
      node: nodeOf("day-one-iho"),
      tree,
      rootPathId: "root",
      topItemId: null,
      isDragging: true,
      projection,
    });

    expect(previousActivity?.pathId).toBe("day-two-bijarim");
  });
});
