import { afterEach, describe, expect, it, vi } from "vitest";

import { PlannerWorkspace } from "@/features/planner/components/planner-workspace";
import { demoPlannerProject } from "@/features/planner/data/demo-planner";
import { usePlannerViewStore } from "@/features/planner/stores/planner-view-store";
import { render, screen, userEvent, within } from "@/testing/test-utils";

const dndState = vi.hoisted(() => ({
  activePathId: null as string | null,
  moveNode: null as ((pathId: string, destination: unknown) => void) | null,
}));

vi.mock("@/features/planner/dnd/use-planner-drag-and-drop", () => ({
  usePlannerDragAndDrop: ({
    moveNode,
    visibleItems,
  }: {
    moveNode: (pathId: string, destination: unknown) => void;
    visibleItems: readonly unknown[];
  }) => {
    dndState.moveNode = moveNode;

    return {
      activePathId: dndState.activePathId,
      childTargetPathId: null,
      expandingTargetPathId: null,
      handleDragCancel: vi.fn(),
      handleDragEnd: vi.fn(),
      handleDragMove: vi.fn(),
      handleDragStart: vi.fn(),
      isSiblingDropActive: false,
      sensors: [],
      sortableItems: visibleItems,
    };
  },
}));

describe("PlannerSchedulePanel", () => {
  afterEach(() => {
    dndState.activePathId = null;
    dndState.moveNode = null;
    usePlannerViewStore.getState().reset();
  });

  it("keeps selection semantics but hides its row highlight while dragging", async () => {
    const user = userEvent.setup();
    usePlannerViewStore.getState().load(demoPlannerProject.nodes);
    usePlannerViewStore.getState().setProjectDetails(demoPlannerProject);
    const onMoveNode = vi.fn();
    const { rerender } = render(
      <PlannerWorkspace isNodeMoveEnabled onMoveNode={onMoveNode} projectId="demo" />,
    );
    const tree = await screen.findByRole("tree", { name: "여행 일정" });

    await user.click(within(tree).getByRole("button", { name: "가보고 싶은 곳" }));
    const selectedRow = within(tree).getByText("가보고 싶은 곳").closest("[role=treeitem]");

    expect(selectedRow).toHaveAttribute("aria-selected", "true");
    expect(selectedRow?.firstElementChild).toHaveClass("bg-brand/10");

    dndState.activePathId =
      [...usePlannerViewStore.getState().tree.entityMap.values()].find(
        (node) => node.name === "제주도",
      )?.pathId ?? null;
    rerender(<PlannerWorkspace isNodeMoveEnabled onMoveNode={onMoveNode} projectId="demo" />);

    expect(selectedRow).toHaveAttribute("aria-selected", "true");
    expect(selectedRow).toHaveAttribute("data-selection-state", "selected");
    expect(selectedRow?.firstElementChild).not.toHaveClass("bg-brand/10");
  });

  it("forwards accepted moves only while realtime writes are enabled", () => {
    const onMoveNode = vi.fn();
    usePlannerViewStore.getState().load(demoPlannerProject.nodes);
    usePlannerViewStore.getState().setProjectDetails(demoPlannerProject);
    const { rerender } = render(
      <PlannerWorkspace isNodeMoveEnabled onMoveNode={onMoveNode} projectId="demo" />,
    );
    const destination = {
      parentPathId: "day-one",
      siblingIndex: 0,
      position: 0.05,
    };

    dndState.moveNode?.("day-one-iho", destination);
    expect(onMoveNode).toHaveBeenCalledWith("day-one-iho", destination);

    rerender(
      <PlannerWorkspace isNodeMoveEnabled={false} onMoveNode={onMoveNode} projectId="demo" />,
    );
    dndState.moveNode?.("day-one-iho", destination);
    expect(onMoveNode).toHaveBeenCalledTimes(1);
  });
});
