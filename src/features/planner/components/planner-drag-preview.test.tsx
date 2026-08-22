import { afterEach, describe, expect, it } from "vitest";

import { PlannerDragPreview } from "@/features/planner/components/planner-drag-preview";
import { demoPlannerProject } from "@/features/planner/data/demo-planner";
import { usePlannerViewStore } from "@/features/planner/stores/planner-view-store";
import type { PlannerActivityNode } from "@/features/planner/types/planner-node";
import { render } from "@/testing/test-utils";

function nodeOf(pathId: string) {
  const node = usePlannerViewStore.getState().tree.entityMap.get(pathId);
  if (!node) throw new Error(`missing node: ${pathId}`);
  return node;
}

// DragOverlay는 잡은 요소 전체(경로 정보 + 행)의 위쪽에 붙으므로
// 경로 정보가 있는 행은 그 높이만큼 내려야 잡은 자리에서 미리보기가 시작한다.
describe("PlannerDragPreview", () => {
  afterEach(() => {
    usePlannerViewStore.getState().reset();
  });

  it("shifts down past the route info of the dragged Activity", () => {
    usePlannerViewStore.getState().load(demoPlannerProject.nodes);
    const { container } = render(
      <PlannerDragPreview
        node={nodeOf("day-one-iho")}
        previousActivity={nodeOf("day-one-airport") as PlannerActivityNode}
      />,
    );

    expect(container.firstElementChild).toHaveStyle({ transform: "translateY(30px)" });
  });

  it("stays in place for the first Activity of a Day", () => {
    usePlannerViewStore.getState().load(demoPlannerProject.nodes);
    const { container } = render(<PlannerDragPreview node={nodeOf("day-one-airport")} />);

    expect(container.firstElementChild).not.toHaveStyle({ transform: "translateY(30px)" });
  });

  it("stays in place when the neighbouring place has no coordinates", () => {
    usePlannerViewStore.getState().load(demoPlannerProject.nodes);
    const { container } = render(
      <PlannerDragPreview
        node={nodeOf("day-one-iho")}
        previousActivity={{
          ...(nodeOf("day-one-airport") as PlannerActivityNode),
          latitude: null,
          longitude: null,
        }}
      />,
    );

    expect(container.firstElementChild).not.toHaveStyle({ transform: "translateY(30px)" });
  });
});
