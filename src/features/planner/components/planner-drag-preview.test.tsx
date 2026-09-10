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

    expect(container.firstElementChild).toHaveStyle({ paddingLeft: "60px" });
  });

  // 목록 폭을 채우면 커서 아래 행을 통째로 덮어 그 행이 사라진 것처럼 보인다.
  it("takes only the width of its own label", () => {
    usePlannerViewStore.getState().load(demoPlannerProject.nodes);
    const { container } = render(<PlannerDragPreview node={nodeOf("day-one-iho")} />);

    expect(container.firstElementChild).toHaveClass("w-fit");
    expect(container.firstElementChild).not.toHaveClass("w-80");
  });
});
