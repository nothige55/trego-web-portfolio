import { afterEach, describe, expect, it, vi } from "vitest";

import type { PlannerNodeEditingCommands } from "@/features/planner/components/planner-schedule-panel";
import { PlannerWorkspace } from "@/features/planner/components/planner-workspace";
import { demoPlannerProject } from "@/features/planner/data/demo-planner";
import { usePlannerViewStore } from "@/features/planner/stores/planner-view-store";
import { fireEvent, render, screen, userEvent, waitFor, within } from "@/testing/test-utils";

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
    updateActivity: vi.fn().mockResolvedValue(undefined),
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

  it("shows the calendar day number when project dates include a timestamp", async () => {
    const user = userEvent.setup();
    usePlannerViewStore.getState().load(demoPlannerProject.nodes);
    usePlannerViewStore.getState().setProjectDetails({
      ...demoPlannerProject,
      startDate: "2026-08-12T00:00:00Z",
      endDate: "2026-08-18T00:00:00Z",
    });
    const { container } = render(
      <PlannerWorkspace isNodeMoveEnabled onMoveNode={vi.fn()} projectId="demo" />,
    );

    const tree = await screen.findByRole("tree", { name: "여행 일정" });
    await user.click(within(tree).getByRole("button", { name: "제주도 펼치기" }));

    expect(
      container.querySelector('[data-planner-icon="calendar"][data-number="12"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-planner-icon="calendar"][data-number="NaN"]'),
    ).not.toBeInTheDocument();
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

  it("asks for confirmation after applying a range that removes Days", async () => {
    const commands = {
      ...createPlannerCommands(),
      updateDateRange: vi.fn().mockResolvedValue(undefined),
    };
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

    const dateRangeButton = await screen.findByRole("button", {
      name: "여행 날짜: 08.12 – 08.18",
    });
    expect(dateRangeButton).toHaveClass("border-brand/25", "bg-brand/10", "text-brand");
    await user.click(dateRangeButton);

    expect(await screen.findByRole("button", { name: "이전 달" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다음 달" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "적용" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "2026년 8월 14일 금요일" }));

    expect(screen.queryByText(/뒤쪽 날짜/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "적용" }));
    expect(
      await screen.findByRole("heading", { name: "여행 기간을 줄일까요?" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/뒤쪽 날짜/)).toBeInTheDocument();
    expect(commands.updateDateRange).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "삭제 후 적용" }));
    expect(commands.updateDateRange).toHaveBeenCalledWith({
      startDate: "2026-08-12",
      endDate: "2026-08-14",
    });
  });

  it("applies a range that adds Days without a confirmation overlay", async () => {
    const commands = {
      ...createPlannerCommands(),
      updateDateRange: vi.fn().mockResolvedValue(undefined),
    };
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

    await user.click(
      await screen.findByRole("button", {
        name: "여행 날짜: 08.12 – 08.18",
      }),
    );
    await user.click(screen.getByRole("button", { name: "2026년 8월 20일 목요일" }));
    await user.click(screen.getByRole("button", { name: "적용" }));

    expect(
      screen.queryByRole("heading", { name: "여행 기간을 줄일까요?" }),
    ).not.toBeInTheDocument();
    expect(commands.updateDateRange).toHaveBeenCalledWith({
      startDate: "2026-08-12",
      endDate: "2026-08-20",
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

  it("keeps Activity names read-only and edits only their memo", async () => {
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
    await user.click(within(tree).getByRole("button", { name: "가보고 싶은 곳 펼치기" }));
    expect(within(tree).getByRole("button", { name: "우도 메모 편집" })).toHaveTextContent(
      "날씨가 좋으면 배편 확인",
    );

    await user.dblClick(within(tree).getByRole("button", { name: "우도" }));
    expect(within(tree).queryByRole("textbox", { name: "우도 이름" })).not.toBeInTheDocument();

    fireEvent.contextMenu(within(tree).getByRole("button", { name: "우도" }));
    await user.click(await screen.findByRole("menuitem", { name: "메모 편집" }));
    const memoInput = screen.getByRole("textbox", { name: "Activity 메모" });
    expect(memoInput).toHaveValue("날씨가 좋으면 배편 확인");
    await user.clear(memoInput);
    await user.type(memoInput, "배편 먼저 예약");
    await user.click(screen.getByRole("button", { name: "저장" }));

    expect(commands.updateActivity).toHaveBeenLastCalledWith({
      id: "demo-wish-udo",
      name: "우도",
      memo: "배편 먼저 예약",
    });
    await waitFor(() =>
      expect(screen.queryByRole("textbox", { name: "Activity 메모" })).not.toBeInTheDocument(),
    );
  });

  it("cancels inline memo editing with Escape", async () => {
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
    await user.click(within(tree).getByRole("button", { name: "가보고 싶은 곳 펼치기" }));
    await user.click(within(tree).getByRole("button", { name: "우도 메모 편집" }));

    const memoInput = screen.getByRole("textbox", { name: "Activity 메모" });
    await user.clear(memoInput);
    await user.type(memoInput, "취소할 메모");
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("textbox", { name: "Activity 메모" })).not.toBeInTheDocument();
    expect(commands.updateActivity).not.toHaveBeenCalled();
    expect(within(tree).getByRole("button", { name: "우도 메모 편집" })).toHaveTextContent(
      "날씨가 좋으면 배편 확인",
    );
  });

  it("keeps the memo draft open when saving fails", async () => {
    const commands = {
      ...createPlannerCommands(),
      updateActivity: vi.fn().mockRejectedValue(new Error("save failed")),
    };
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
    await user.click(within(tree).getByRole("button", { name: "가보고 싶은 곳 펼치기" }));
    fireEvent.contextMenu(within(tree).getByRole("button", { name: "우도" }));
    await user.click(await screen.findByRole("menuitem", { name: "메모 편집" }));

    const memoInput = screen.getByRole("textbox", { name: "Activity 메모" });
    await user.clear(memoInput);
    await user.type(memoInput, "배편 먼저 예약");
    await user.click(screen.getByRole("button", { name: "저장" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "메모를 저장하지 못했습니다. 다시 시도해 주세요.",
    );
    expect(memoInput).toHaveValue("배편 먼저 예약");
    expect(screen.getByRole("textbox", { name: "Activity 메모" })).toBeInTheDocument();
  });

  it("creates a date at the trip root without exposing a parent selector", async () => {
    const commands = {
      ...createPlannerCommands(),
      createNode: vi.fn().mockResolvedValue(undefined),
      extendDateRange: vi.fn().mockResolvedValue(undefined),
    };
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

    await user.click(await screen.findByRole("button", { name: "일정 추가" }));
    expect(screen.getByRole("combobox", { name: "일정 종류" })).toHaveDisplayValue("날짜");
    expect(screen.queryByRole("option", { name: "Activity" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "상위 일정" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "새 일정 이름" })).not.toBeInTheDocument();
    expect(screen.getByText("현재 종료일 다음 날짜를 추가합니다.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "추가" }));

    expect(commands.extendDateRange).toHaveBeenCalledTimes(1);
    expect(commands.createNode).not.toHaveBeenCalled();
  });

  it("runs grouped selection commands from the keyboard", async () => {
    const commands = {
      ...createPlannerCommands(),
      deleteNodes: vi.fn().mockResolvedValue(undefined),
      groupNodes: vi.fn().mockResolvedValue(undefined),
      redo: vi.fn().mockResolvedValue(undefined),
      undo: vi.fn().mockResolvedValue(undefined),
    };
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
    await user.click(within(tree).getByRole("button", { name: "가보고 싶은 곳 펼치기" }));
    await user.click(within(tree).getByRole("button", { name: "우도" }));
    await user.keyboard("{Shift>}");
    await user.click(within(tree).getByRole("button", { name: "아르떼뮤지엄 제주" }));
    await user.keyboard("{/Shift}");
    tree.focus();
    await user.keyboard("{Meta>}g{/Meta}");

    expect(commands.groupNodes).toHaveBeenCalledWith(["wish-udo", "wish-arte-museum"]);
    await user.keyboard("{Backspace}");
    expect(commands.deleteNodes).toHaveBeenCalledWith(["wish-udo", "wish-arte-museum"]);

    fireEvent.keyDown(window, { key: "z", metaKey: true });
    expect(commands.undo).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: "z", metaKey: true, shiftKey: true });
    expect(commands.redo).toHaveBeenCalledTimes(1);
  });
});
