import { describe, expect, it } from "vitest";

import { demoPlannerProject } from "@/features/planner/data/demo-planner";
import { buildPlannerTree } from "@/features/planner/utils/build-planner-tree";
import {
  getPlannerRouteHighlight,
  getPlannerRowHighlight,
  getPlannerSelectionState,
} from "@/features/planner/utils/get-planner-row-highlight";

describe("getPlannerSelectionState", () => {
  const tree = buildPlannerTree(demoPlannerProject.nodes);
  const stateOf = (
    pathId: string,
    selection: Partial<Parameters<typeof getPlannerSelectionState>[1]>,
  ) =>
    getPlannerSelectionState(
      tree.entityMap.get(pathId)!,
      { selectedItemId: null, multiSelectedIds: [], selectionRangeIds: [], ...selection },
      tree.entityMap,
    );

  it("marks only the single selected node when nothing is multi-selected", () => {
    expect(stateOf("day-one-aewol", { selectedItemId: "day-one-aewol" })).toBe("selected");
    // 단일 선택은 자손까지 작업 대상으로 넓히지 않음
    expect(stateOf("day-one-aewol", { selectedItemId: "day-one" })).toBeNull();
  });

  it("treats multi-selected nodes as targets and their descendants as range", () => {
    const selection = { selectedItemId: "day-one-airport", multiSelectedIds: ["day-one"] };

    expect(stateOf("day-one", selection)).toBe("selected");
    expect(stateOf("day-one-aewol", selection)).toBe("range");
    // Shift 선택 중에는 anchor도 정규화된 대상에 들지 않으면 강하게 표시하지 않음
    expect(stateOf("day-one-airport", selection)).toBe("range");
  });

  it("keeps shift range rows as range even without a selected ancestor", () => {
    expect(
      stateOf("day-one-iho", {
        multiSelectedIds: ["day-one-airport"],
        selectionRangeIds: ["day-one-airport", "day-one-iho"],
      }),
    ).toBe("range");
  });
});

describe("getPlannerRowHighlight", () => {
  it("prefers selection, then map hover, then range", () => {
    expect(
      getPlannerRowHighlight({
        selectionState: "selected",
        isMapHovered: true,
        isSelectionHighlightSuppressed: false,
      }),
    ).toBe("selected");
    expect(
      getPlannerRowHighlight({
        selectionState: "range",
        isMapHovered: true,
        isSelectionHighlightSuppressed: false,
      }),
    ).toBe("hovered");
    expect(
      getPlannerRowHighlight({
        selectionState: "range",
        isMapHovered: false,
        isSelectionHighlightSuppressed: false,
      }),
    ).toBe("range");
  });

  it("hides only the selection highlight while dragging", () => {
    expect(
      getPlannerRowHighlight({
        selectionState: "selected",
        isMapHovered: false,
        isSelectionHighlightSuppressed: true,
      }),
    ).toBeNull();
    expect(
      getPlannerRowHighlight({
        selectionState: "selected",
        isMapHovered: true,
        isSelectionHighlightSuppressed: true,
      }),
    ).toBe("hovered");
  });
});

describe("getPlannerRouteHighlight", () => {
  it("fills a segment only when both places are highlighted", () => {
    expect(getPlannerRouteHighlight("selected", null)).toBeNull();
    expect(getPlannerRouteHighlight(null, "selected")).toBeNull();
    expect(getPlannerRouteHighlight("selected", "selected")).toBe("selected");
  });

  it("follows the lighter of the two tones", () => {
    expect(getPlannerRouteHighlight("selected", "range")).toBe("range");
    expect(getPlannerRouteHighlight("range", "selected")).toBe("range");
    expect(getPlannerRouteHighlight("range", "range")).toBe("range");
  });
});
