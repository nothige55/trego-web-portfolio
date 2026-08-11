import { afterEach, describe, expect, it, vi } from "vitest";

import type { PlannerNodeEditingCommands } from "@/features/planner/components/planner-schedule-panel";
import { PlannerWorkspace } from "@/features/planner/components/planner-workspace";
import { demoPlannerProject } from "@/features/planner/data/demo-planner";
import { usePlannerViewStore } from "@/features/planner/stores/planner-view-store";
import { fireEvent, render, screen, userEvent, within } from "@/testing/test-utils";

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

function createPlannerCommands(): PlannerNodeEditingCommands {
  return {
    updateFolder: vi.fn().mockResolvedValue(undefined),
    updateDay: vi.fn().mockResolvedValue(undefined),
    deleteNode: vi.fn().mockResolvedValue(undefined),
  };
}

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

  it("renames folders and Days inline only after Enter", async () => {
    const commands = createPlannerCommands();
    const user = userEvent.setup();
    usePlannerViewStore.getState().load(demoPlannerProject.nodes);
    usePlannerViewStore.getState().setProjectDetails(demoPlannerProject);
    render(
      <PlannerWorkspace
        isNodeMoveEnabled
        onMoveNode={vi.fn()}
        plannerCommands={commands}
        projectId="demo"
      />,
    );
    const tree = await screen.findByRole("tree", { name: "여행 일정" });

    await user.dblClick(within(tree).getByRole("button", { name: "제주도" }));
    const folderNameInput = within(tree).getByRole("textbox", { name: "제주도 이름" });
    await user.clear(folderNameInput);
    await user.type(folderNameInput, "제주 동부");
    fireEvent.blur(folderNameInput);
    expect(commands.updateFolder).not.toHaveBeenCalled();

    await user.click(within(tree).getByRole("button", { name: "제주도 펼치기" }));
    const dayNameButton = within(tree).getByRole("button", { name: "8월 12일" });
    const dayRow = dayNameButton.closest("[role=treeitem]");
    const dayRowSurface = dayRow?.querySelector('[data-slot="context-menu-trigger"]');
    expect(dayRowSurface).toHaveClass("h-9");

    await user.dblClick(dayNameButton);
    const dayNameInput = within(tree).getByRole("textbox", { name: "8월 12일 이름" });
    expect(dayNameInput.closest("[role=treeitem]")).toBe(dayRow);
    expect(dayRowSurface).toHaveClass("h-9");
    expect(dayNameInput).toHaveClass("text-sm", "leading-none", "font-medium");
    expect(dayNameInput).toHaveClass("-left-2", "px-2");
    await user.clear(dayNameInput);
    await user.type(dayNameInput, "제주 도착일{Enter}");

    expect(commands.updateDay).toHaveBeenCalledWith({
      id: "demo-day-one",
      name: "제주 도착일",
      color: "#FF6B6B",
    });
  });

  it("changes a Day color from the row context menu", async () => {
    const commands = createPlannerCommands();
    const user = userEvent.setup();
    usePlannerViewStore.getState().load(demoPlannerProject.nodes);
    usePlannerViewStore.getState().setProjectDetails(demoPlannerProject);
    render(
      <PlannerWorkspace
        isNodeMoveEnabled
        onMoveNode={vi.fn()}
        plannerCommands={commands}
        projectId="demo"
      />,
    );
    const tree = await screen.findByRole("tree", { name: "여행 일정" });

    await user.click(within(tree).getByRole("button", { name: "제주도 펼치기" }));
    fireEvent.contextMenu(within(tree).getByRole("button", { name: "8월 12일" }));
    expect(screen.queryByText("Day 색상")).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Day 색상 선택" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "색상 #FF4081 선택" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "색상 #4CAF50 선택" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "이전 Day 색상" }));
    expect(screen.getByRole("menuitem", { name: "색상 #E91E63 선택" })).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "다음 Day 색상" }));
    await user.click(screen.getByRole("menuitem", { name: "다음 Day 색상" }));
    await user.click(await screen.findByRole("menuitem", { name: "색상 #4CAF50 선택" }));

    expect(commands.updateDay).toHaveBeenCalledWith({
      id: "demo-day-one",
      name: "8월 12일",
      color: "#4CAF50",
    });
  });

  it("deletes only the context-menu target node", async () => {
    const commands = createPlannerCommands();
    const user = userEvent.setup();
    usePlannerViewStore.getState().load(demoPlannerProject.nodes);
    usePlannerViewStore.getState().setProjectDetails(demoPlannerProject);
    render(
      <PlannerWorkspace
        isNodeMoveEnabled
        onMoveNode={vi.fn()}
        plannerCommands={commands}
        projectId="demo"
      />,
    );
    const tree = await screen.findByRole("tree", { name: "여행 일정" });

    await user.click(within(tree).getByRole("button", { name: "제주도 펼치기" }));
    await user.click(within(tree).getByRole("button", { name: "8월 12일 펼치기" }));
    const airportButton = within(tree).getByText("제주국제공항").closest("button");
    expect(airportButton).not.toBeNull();
    fireEvent.contextMenu(airportButton!);
    await user.click(await screen.findByRole("menuitem", { name: "삭제" }));

    expect(commands.deleteNode).toHaveBeenCalledTimes(1);
    expect(commands.deleteNode).toHaveBeenCalledWith({ pathId: "day-one-airport" });
  });
});
