import { afterEach, describe, expect, it, vi } from "vitest";

import { PlannerWorkspace } from "@/features/planner/components/planner-workspace";
import { demoPlannerProject } from "@/features/planner/data/demo-planner";
import { usePlannerViewStore } from "@/features/planner/stores/planner-view-store";
import type { PlannerNodeEditingCommands } from "@/features/planner/types/planner-editing-commands";
import { fireEvent, render, screen, userEvent, waitFor, within } from "@/testing/test-utils";

// jsdom에는 WebGL이 없어 실제 PlannerMap은 항상 초기화에 실패하고 role="alert" 안내를 띄움
// 이 파일이 검증하는 일정 패널과 무관하므로 지도는 대체
vi.mock("@/features/planner/components/planner-map", () => ({
  PlannerMap: () => <section aria-label="지도 영역" />,
}));

const dndState = vi.hoisted(() => ({
  activePathId: null as string | null,
  dropDestination: null as { parentPathId: string; siblingIndex: number } | null,
  isOutsideList: false,
  isSiblingDropActive: false,
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
      dropDestination: dndState.dropDestination,
      expandingTargetPathId: null,
      handleDragCancel: vi.fn(),
      handleDragEnd: vi.fn(),
      handleDragMove: vi.fn(),
      handleDragStart: vi.fn(),
      isOutsideList: dndState.isOutsideList,
      isSiblingDropActive: dndState.isSiblingDropActive,
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
    dndState.dropDestination = null;
    dndState.isOutsideList = false;
    dndState.isSiblingDropActive = false;
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

    const rowOf = (item: Element | null | undefined) =>
      item?.querySelector('[data-slot="context-menu-trigger"]');

    expect(selectedRow).toHaveAttribute("aria-selected", "true");
    expect(rowOf(selectedRow)).toHaveClass("bg-brand/10");

    dndState.activePathId =
      [...usePlannerViewStore.getState().tree.entityMap.values()].find(
        (node) => node.name === "제주도",
      )?.pathId ?? null;
    rerender(<PlannerWorkspace isNodeMoveEnabled onMoveNode={onMoveNode} projectId="demo" />);

    expect(selectedRow).toHaveAttribute("aria-selected", "true");
    expect(selectedRow).toHaveAttribute("data-selection-state", "selected");
    expect(rowOf(selectedRow)).not.toHaveClass("bg-brand/10");
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

  it("shares row hover with the map and shows route assistance between scheduled places", async () => {
    const user = userEvent.setup();
    usePlannerViewStore.getState().load(demoPlannerProject.nodes);
    usePlannerViewStore.getState().setProjectDetails(demoPlannerProject);
    render(<PlannerWorkspace isNodeMoveEnabled onMoveNode={vi.fn()} projectId="demo" />);
    const tree = await screen.findByRole("tree", { name: "여행 일정" });

    await user.click(within(tree).getByRole("button", { name: "제주도 펼치기" }));
    await user.click(within(tree).getByRole("button", { name: "8월 12일 펼치기" }));
    const airportItem = within(tree).getByText("제주국제공항").closest("[role=treeitem]");
    const airportSurface = airportItem?.querySelector('[data-slot="context-menu-trigger"]');
    expect(airportSurface).not.toBeNull();

    fireEvent.pointerEnter(airportSurface!);
    expect(usePlannerViewStore.getState().hoveredItemId).toBe("day-one-airport");
    expect(airportItem).toHaveAttribute("data-map-highlight", "hovered");

    fireEvent.pointerLeave(airportSurface!);
    expect(usePlannerViewStore.getState().hoveredItemId).toBeNull();
    expect(airportItem).not.toHaveAttribute("data-map-highlight");

    expect(screen.getByTestId("planner-route-day-one-iho")).toHaveTextContent(
      "3.9km·자동차 15분길찾기",
    );
  });

  // 경로 정보는 두 노드 사이의 것이라 드래그 단위 안에 들어가면 rect와 충돌 판정이 어긋남
  it("keeps route info outside the draggable node", async () => {
    const user = userEvent.setup();
    usePlannerViewStore.getState().load(demoPlannerProject.nodes);
    usePlannerViewStore.getState().setProjectDetails(demoPlannerProject);
    render(<PlannerWorkspace isNodeMoveEnabled onMoveNode={vi.fn()} projectId="demo" />);
    const tree = await screen.findByRole("tree", { name: "여행 일정" });

    await user.click(within(tree).getByRole("button", { name: "제주도 펼치기" }));
    await user.click(within(tree).getByRole("button", { name: "8월 12일 펼치기" }));
    const ihoItem = within(tree).getByText("이호테우해변").closest("[role=treeitem]");
    const routeInfo = screen.getByTestId("planner-route-day-one-iho");
    const nodeBox = ihoItem?.querySelector("[data-planner-node]");

    // 노드와 함께 움직이도록 같은 treeitem 안에 있되, 잡는 단위 밖에 놓임
    expect(ihoItem?.contains(routeInfo)).toBe(true);
    expect(nodeBox?.contains(routeInfo)).toBe(false);
    // 노드 박스 바로 앞자리. 밀림 transform을 자식에 걸려고 한 겹 더 감싸므로 포함으로 봄
    expect(
      nodeBox?.previousElementSibling?.contains(routeInfo.closest("[data-planner-route-slot]")),
    ).toBe(true);
  });

  // 경로 정보는 노드의 속성이 아니라 두 장소 사이의 구간이라, 잡은 노드가 빠지면
  // 사라지는 게 아니라 앞뒤가 이어붙음. 드래그 중에도 지금 놓으면 나올 값을 보여 줌
  it("reconnects the route across the place that is being dragged out", async () => {
    const user = userEvent.setup();
    usePlannerViewStore.getState().load(demoPlannerProject.nodes);
    usePlannerViewStore.getState().setProjectDetails(demoPlannerProject);
    const onMoveNode = vi.fn();
    const { rerender } = render(
      <PlannerWorkspace isNodeMoveEnabled onMoveNode={onMoveNode} projectId="demo" />,
    );
    const tree = await screen.findByRole("tree", { name: "여행 일정" });

    await user.click(within(tree).getByRole("button", { name: "제주도 펼치기" }));
    await user.click(within(tree).getByRole("button", { name: "8월 12일 펼치기" }));
    expect(
      within(screen.getByTestId("planner-route-day-one-aewol")).getByRole("link"),
    ).toHaveAccessibleName("이호테우해변에서 애월 해안도로까지 길찾기");

    // 목록 밖(좌우)으로 끌어내 목적지가 없는 상태
    dndState.activePathId = "day-one-iho";
    dndState.isOutsideList = true;
    rerender(<PlannerWorkspace isNodeMoveEnabled onMoveNode={onMoveNode} projectId="demo" />);

    // 이호테우해변이 빠진 자리에서 앞뒤 장소가 곧바로 이어짐
    expect(
      within(screen.getByTestId("planner-route-day-one-aewol")).getByRole("link"),
    ).toHaveAccessibleName("제주국제공항에서 애월 해안도로까지 길찾기");
    // 목록 밖으로 나온 노드에는 들어오는 구간이 없음
    expect(screen.queryByTestId("planner-route-day-one-iho")).not.toBeInTheDocument();
    // 떨어져 있는 구간은 그대로
    expect(
      within(screen.getByTestId("planner-route-day-one-hyeopjae")).getByRole("link"),
    ).toHaveAccessibleName("애월 해안도로에서 협재해수욕장까지 길찾기");
  });

  // 받아 주지 않는 자리나 컨테이너 안으로 넣는 중에는 놓아도 순서가 바뀌지 않으므로
  // 목록도 경로 정보도 원래 모습 그대로 둠
  it("leaves the schedule untouched while hovering where it cannot land", async () => {
    const user = userEvent.setup();
    usePlannerViewStore.getState().load(demoPlannerProject.nodes);
    usePlannerViewStore.getState().setProjectDetails(demoPlannerProject);
    const onMoveNode = vi.fn();
    const { rerender } = render(
      <PlannerWorkspace isNodeMoveEnabled onMoveNode={onMoveNode} projectId="demo" />,
    );
    const tree = await screen.findByRole("tree", { name: "여행 일정" });

    await user.click(within(tree).getByRole("button", { name: "제주도 펼치기" }));
    await user.click(within(tree).getByRole("button", { name: "8월 12일 펼치기" }));

    dndState.activePathId = "day-one-iho";
    rerender(<PlannerWorkspace isNodeMoveEnabled onMoveNode={onMoveNode} projectId="demo" />);

    expect(
      within(screen.getByTestId("planner-route-day-one-iho")).getByRole("link"),
    ).toHaveAccessibleName("제주국제공항에서 이호테우해변까지 길찾기");
    expect(
      within(screen.getByTestId("planner-route-day-one-aewol")).getByRole("link"),
    ).toHaveAccessibleName("이호테우해변에서 애월 해안도로까지 길찾기");
  });

  it("previews the two segments that a drop position would create", async () => {
    const user = userEvent.setup();
    usePlannerViewStore.getState().load(demoPlannerProject.nodes);
    usePlannerViewStore.getState().setProjectDetails(demoPlannerProject);
    const onMoveNode = vi.fn();
    const { rerender } = render(
      <PlannerWorkspace isNodeMoveEnabled onMoveNode={onMoveNode} projectId="demo" />,
    );
    const tree = await screen.findByRole("tree", { name: "여행 일정" });

    await user.click(within(tree).getByRole("button", { name: "제주도 펼치기" }));
    await user.click(within(tree).getByRole("button", { name: "8월 12일 펼치기" }));

    // 이호테우해변을 빼서 제주국제공항과 애월 해안도로 사이에 도로 끼우는 자리
    dndState.activePathId = "day-one-iho";
    dndState.isSiblingDropActive = true;
    dndState.dropDestination = { parentPathId: "day-one", siblingIndex: 1 };
    rerender(<PlannerWorkspace isNodeMoveEnabled onMoveNode={onMoveNode} projectId="demo" />);

    expect(
      within(screen.getByTestId("planner-route-day-one-iho")).getByRole("link"),
    ).toHaveAccessibleName("제주국제공항에서 이호테우해변까지 길찾기");
    expect(
      within(screen.getByTestId("planner-route-day-one-aewol")).getByRole("link"),
    ).toHaveAccessibleName("이호테우해변에서 애월 해안도로까지 길찾기");

    // 맨 뒤로 옮기면 두 구간 모두 새 이웃으로 다시 잡힘
    dndState.dropDestination = { parentPathId: "day-one", siblingIndex: 3 };
    rerender(<PlannerWorkspace isNodeMoveEnabled onMoveNode={onMoveNode} projectId="demo" />);

    expect(
      within(screen.getByTestId("planner-route-day-one-iho")).getByRole("link"),
    ).toHaveAccessibleName("협재해수욕장에서 이호테우해변까지 길찾기");
    expect(
      within(screen.getByTestId("planner-route-day-one-aewol")).getByRole("link"),
    ).toHaveAccessibleName("제주국제공항에서 애월 해안도로까지 길찾기");
  });

  it("extends the selection highlight from the label to its memo", async () => {
    const user = userEvent.setup();
    usePlannerViewStore.getState().load(demoPlannerProject.nodes);
    usePlannerViewStore.getState().setProjectDetails(demoPlannerProject);
    render(<PlannerWorkspace isNodeMoveEnabled onMoveNode={vi.fn()} projectId="demo" />);
    const tree = await screen.findByRole("tree", { name: "여행 일정" });

    await user.click(within(tree).getByRole("button", { name: "제주도 펼치기" }));
    await user.click(within(tree).getByRole("button", { name: "8월 12일 펼치기" }));
    const memo = within(tree).getByText("카페에서 잠시 쉬기");
    expect(memo.closest("[class*='border-l-2']")).not.toHaveClass("bg-brand/5");

    await user.click(within(tree).getByText("애월 해안도로"));

    expect(within(tree).getByText("애월 해안도로").closest("[role=treeitem]")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(memo.closest("[class*='border-l-2']")).toHaveClass("bg-brand/5");
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
