import { afterEach, describe, expect, it } from "vitest";

import { PlannerDragPreview } from "@/features/planner/components/planner-drag-preview";
import { demoPlannerProject } from "@/features/planner/data/demo-planner";
import { usePlannerViewStore } from "@/features/planner/stores/planner-view-store";
import { render, screen } from "@/testing/test-utils";

function nodeOf(pathId: string) {
  const node = usePlannerViewStore.getState().tree.entityMap.get(pathId);
  if (!node) throw new Error(`missing node: ${pathId}`);
  return node;
}

describe("PlannerDragPreview", () => {
  afterEach(() => {
    usePlannerViewStore.getState().reset();
  });

  it("starts at the label with no vertical correction", () => {
    usePlannerViewStore.getState().load(demoPlannerProject.nodes);
    const { container } = render(<PlannerDragPreview node={nodeOf("day-one-iho")} />);

    expect(container.firstElementChild).not.toHaveStyle({ transform: "translateY(24px)" });
    expect(screen.getByText("이호테우해변")).toBeInTheDocument();
  });

  it("keeps the row indentation of its depth", () => {
    usePlannerViewStore.getState().load(demoPlannerProject.nodes);
    const { container } = render(<PlannerDragPreview node={nodeOf("day-one-iho")} />);

    expect(container.firstElementChild?.firstElementChild).toHaveStyle({ paddingLeft: "60px" });
  });
});
