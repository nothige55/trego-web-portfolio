import { describe, expect, it } from "vitest";

import { demoPlannerProject } from "@/features/planner/data/demo-planner";
import {
  buildPlannerDragVisualOrder,
  calculatePlannerDragOffsets,
} from "@/features/planner/utils/build-planner-drag-layout";
import { buildPlannerDragProjection } from "@/features/planner/utils/build-planner-drag-projection";
import { buildPlannerTree } from "@/features/planner/utils/build-planner-tree";

const tree = buildPlannerTree(demoPlannerProject.nodes);
const nodeOf = (pathId: string) => tree.entityMap.get(pathId)!;
const rowsOf = (...pathIds: string[]) => pathIds.map(nodeOf);
const namesOf = (rows: ReturnType<typeof rowsOf> | readonly { pathId: string }[] | null) =>
  rows?.map((row) => row.pathId) ?? null;

describe("buildPlannerDragVisualOrder", () => {
  // 8월 12일만 펼친 상태로 화면에 그려진 행들이다.
  const rows = rowsOf(
    "day-one",
    "day-one-airport",
    "day-one-iho",
    "day-one-aewol",
    "day-one-hyeopjae",
    "day-two",
  );
  const expandedIds = new Set(["day-one"]);
  const orderFor = (
    activePathId: string,
    destination: { parentPathId: string; siblingIndex: number } | null,
  ) =>
    namesOf(
      buildPlannerDragVisualOrder({
        rows,
        activePathId,
        projection: buildPlannerDragProjection({ tree, activePathId, destination })!,
        rootPathId: "root",
        expandedIds,
      }),
    );

  it("closes the list over the held node when it has nowhere to land", () => {
    expect(orderFor("day-one-airport", null)).toEqual([
      "day-one",
      "day-one-iho",
      "day-one-aewol",
      "day-one-hyeopjae",
      "day-two",
    ]);
  });

  it("puts the held node in front of the sibling that will follow it", () => {
    expect(orderFor("day-one-iho", { parentPathId: "day-one", siblingIndex: 2 })).toEqual([
      "day-one",
      "day-one-airport",
      "day-one-aewol",
      "day-one-iho",
      "day-one-hyeopjae",
      "day-two",
    ]);
  });

  it("moves the held node to the very front of its Day", () => {
    expect(orderFor("day-one-aewol", { parentPathId: "day-one", siblingIndex: 0 })).toEqual([
      "day-one",
      "day-one-aewol",
      "day-one-airport",
      "day-one-iho",
      "day-one-hyeopjae",
      "day-two",
    ]);
  });

  // 뒤따르는 형제가 없으면 부모 가지의 끝, 다음 Day 행 바로 앞이다.
  it("appends the held node at the end of its Day", () => {
    expect(orderFor("day-one-airport", { parentPathId: "day-one", siblingIndex: 3 })).toEqual([
      "day-one",
      "day-one-iho",
      "day-one-aewol",
      "day-one-hyeopjae",
      "day-one-airport",
      "day-two",
    ]);
  });

  it("reports nothing to show when the destination is inside a collapsed Day", () => {
    expect(orderFor("day-one-iho", { parentPathId: "day-two", siblingIndex: 99 })).toBeNull();
  });
});

describe("calculatePlannerDragOffsets", () => {
  // 메모가 달린 행은 높고, Day의 첫 장소는 경로 정보 칸이 없다.
  const heights = new Map([
    ["day-one-airport", 64],
    ["day-one-iho", 36],
    ["day-one-aewol", 63],
    ["day-one-hyeopjae", 36],
  ]);
  const layout = rowsOf("day-one-airport", "day-one-iho", "day-one-aewol", "day-one-hyeopjae");
  const layoutSlots = new Set(["day-one-iho", "day-one-aewol", "day-one-hyeopjae"]);
  const offsetsFor = (visualIds: string[], visualSlots: string[]) =>
    Object.fromEntries(
      calculatePlannerDragOffsets({
        layoutRows: layout,
        visualRows: rowsOf(...visualIds),
        getNodeHeight: (pathId) => heights.get(pathId) ?? 0,
        hasLayoutSlot: (row) => layoutSlots.has(row.pathId),
        hasVisualSlot: (row) => visualSlots.includes(row.pathId),
        slotHeight: 24,
      }),
    );

  it("matches the sortable shift for an ordinary move in the middle", () => {
    expect(
      offsetsFor(
        ["day-one-airport", "day-one-aewol", "day-one-iho", "day-one-hyeopjae"],
        ["day-one-aewol", "day-one-iho", "day-one-hyeopjae"],
      ),
    ).toEqual({
      "day-one-airport": 0,
      "day-one-aewol": -60,
      "day-one-iho": 87,
      "day-one-hyeopjae": 0,
    });
  });

  // 첫 장소를 맨 뒤로: 두 번째 장소가 칸을 잃고, 옮겨 간 첫 장소가 칸을 얻는다.
  it("moves the route slot along with the first place of a Day", () => {
    expect(
      offsetsFor(
        ["day-one-iho", "day-one-aewol", "day-one-hyeopjae", "day-one-airport"],
        ["day-one-aewol", "day-one-hyeopjae", "day-one-airport"],
      ),
    ).toEqual({
      "day-one-iho": -88,
      "day-one-aewol": -88,
      "day-one-hyeopjae": -88,
      "day-one-airport": 207,
    });
  });

  it("closes the gap without an empty slot when the first place leaves the list", () => {
    const offsets = offsetsFor(
      ["day-one-iho", "day-one-aewol", "day-one-hyeopjae"],
      ["day-one-aewol", "day-one-hyeopjae"],
    );

    expect(offsets).toEqual({
      "day-one-iho": -88,
      "day-one-aewol": -88,
      "day-one-hyeopjae": -88,
    });
  });
});
