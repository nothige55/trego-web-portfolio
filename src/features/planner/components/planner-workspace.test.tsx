import { afterEach, describe, expect, it, vi } from "vitest";

import { PlannerWorkspace } from "@/features/planner/components/planner-workspace";
import { usePlannerMapStore } from "@/features/planner/stores/planner-map-store";
import { usePlannerViewStore } from "@/features/planner/stores/planner-view-store";
import { fireEvent, render, screen, userEvent, within } from "@/testing/test-utils";

vi.mock("@/features/planner/components/planner-map", () => ({
  PlannerMap: () => {
    const isModuleCollapsed = usePlannerViewStore((state) => state.isModuleCollapsed);
    const setModuleCollapsed = usePlannerViewStore((state) => state.setModuleCollapsed);

    return (
      <section aria-label="지도 영역">
        {isModuleCollapsed ? (
          <button
            type="button"
            onClick={() => {
              setModuleCollapsed(false);
            }}
          >
            패널 열기
          </button>
        ) : null}
      </section>
    );
  },
}));

// 실제 Maps나 API 없이 사용자가 확인할 수 있는 Planner shell의 동작만 검증한다.
describe("PlannerWorkspace", () => {
  afterEach(() => {
    usePlannerMapStore.getState().reset();
    usePlannerViewStore.getState().reset();
  });

  async function renderPlanner() {
    const user = userEvent.setup();
    render(<PlannerWorkspace projectId="demo" />);
    await screen.findByRole("main", { name: "여행 일정 플래너" });
    return user;
  }

  function mockPlannerRowTops(
    tree: HTMLElement,
    scrollArea: HTMLElement,
    topByName: ReadonlyMap<string, number>,
  ) {
    scrollArea.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
    within(tree)
      .getAllByRole("treeitem")
      .forEach((treeItem) => {
        const name = [...topByName.keys()].find((candidate) =>
          treeItem.textContent?.includes(candidate),
        );
        const top = name ? (topByName.get(name) ?? 100) : 100;
        treeItem.getBoundingClientRect = () => ({ top }) as DOMRect;
      });
  }

  it("renders the schedule, module, and map regions", async () => {
    await renderPlanner();

    expect(screen.getByRole("complementary", { name: "일정 패널" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Planner 보조 패널" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "지도 영역" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "제주도 7일 여행" })).toBeInTheDocument();
  });

  it("toggles Day map visibility without selecting the row", async () => {
    const user = await renderPlanner();
    const tree = screen.getByRole("tree", { name: "여행 일정" });

    await user.click(within(tree).getByRole("button", { name: "제주도 펼치기" }));
    const dayRow = within(tree).getByText("8월 12일").closest("[role=treeitem]");

    await user.click(within(tree).getByRole("button", { name: "8월 12일 지도에서 숨기기" }));

    expect(usePlannerMapStore.getState().hiddenDayIds).toContain("day-one");
    expect(dayRow).toHaveAttribute("aria-selected", "false");
    expect(
      within(tree).getByRole("button", { name: "8월 12일 지도에 표시하기" }),
    ).toBeInTheDocument();
  });

  it("expands a branch, selects a range, and clears the selection from empty space", async () => {
    const user = await renderPlanner();
    const tree = screen.getByRole("tree", { name: "여행 일정" });

    expect(within(tree).queryByText("우도")).not.toBeInTheDocument();
    await user.click(within(tree).getByRole("button", { name: "가보고 싶은 곳 펼치기" }));
    expect(within(tree).getByText("우도")).toBeInTheDocument();
    expect(within(tree).queryByText("8월 12일")).not.toBeInTheDocument();
    await user.click(within(tree).getByRole("button", { name: "제주도 펼치기" }));
    expect(within(tree).getByText("8월 12일")).toBeInTheDocument();
    expect(
      within(tree)
        .getByText("8월 12일")
        .closest("[role=treeitem]")
        ?.querySelector('[data-planner-icon="calendar"][data-number="12"][data-color="#FF6B6B"]'),
    ).toBeInTheDocument();

    await user.click(within(tree).getByRole("button", { name: "8월 12일 펼치기" }));
    expect(
      within(tree)
        .getByText("제주국제공항")
        .closest("[role=treeitem]")
        ?.querySelector('[data-planner-icon="marker"][data-number="1"]'),
    ).toBeInTheDocument();
    expect(
      within(tree)
        .getByText("애월 해안도로")
        .closest("[role=treeitem]")
        ?.querySelector('[data-planner-icon="marker"][data-number="3"]'),
    ).toBeInTheDocument();

    await user.click(within(tree).getByRole("button", { name: "가보고 싶은 곳" }));
    await user.keyboard("{Shift>}");
    await user.click(within(tree).getByRole("button", { name: "제주도" }));
    await user.keyboard("{/Shift}");

    expect(within(tree).getByText("가보고 싶은 곳").closest("[role=treeitem]")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(within(tree).getByText("제주도").closest("[role=treeitem]")).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await user.click(tree);
    expect(within(tree).getByText("가보고 싶은 곳").closest("[role=treeitem]")).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("hides collapse-all for collapsed top-level branches while preserving descendant state", async () => {
    const user = await renderPlanner();
    const tree = screen.getByRole("tree", { name: "여행 일정" });

    await user.click(within(tree).getByRole("button", { name: "제주도 펼치기" }));
    await user.click(within(tree).getByRole("button", { name: "8월 12일 펼치기" }));
    expect(within(tree).getByText("제주국제공항")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "모든 일정 접기" })).toBeInTheDocument();

    await user.click(within(tree).getByRole("button", { name: "제주도 접기" }));
    expect(within(tree).queryByText("8월 12일")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "모든 일정 접기" })).not.toBeInTheDocument();

    await user.click(within(tree).getByRole("button", { name: "제주도 펼치기" }));
    expect(within(tree).getByText("제주국제공항")).toBeInTheDocument();
  });

  it("shows the scrolled node ancestors in a sticky breadcrumb", async () => {
    const user = await renderPlanner();
    const tree = screen.getByRole("tree", { name: "여행 일정" });

    await user.click(within(tree).getByRole("button", { name: "제주도 펼치기" }));
    await user.click(within(tree).getByRole("button", { name: "8월 12일 펼치기" }));

    const scrollArea = screen.getByTestId("planner-schedule-scroll-area");
    expect(scrollArea.firstElementChild).toBe(screen.getByTestId("planner-breadcrumb-placeholder"));
    expect(scrollArea.children[1]).toBe(tree);
    expect(screen.queryByRole("navigation", { name: "현재 일정 경로" })).not.toBeInTheDocument();
    const topByName = new Map([
      ["가보고 싶은 곳", -300],
      ["제주도", -250],
      ["8월 12일", -200],
      ["제주국제공항", 20],
      ["이호테우해변", 60],
    ]);

    mockPlannerRowTops(tree, scrollArea, topByName);

    fireEvent.scroll(scrollArea);

    const breadcrumb = screen.getByRole("navigation", { name: "현재 일정 경로" });
    expect(within(breadcrumb).getByText("제주도")).toBeInTheDocument();
    expect(within(breadcrumb).getByText("8월 12일")).toBeInTheDocument();
    expect(within(breadcrumb).queryByText("제주국제공항")).not.toBeInTheDocument();
    expect(within(breadcrumb).queryByText("제주도 7일 여행")).not.toBeInTheDocument();
    expect(scrollArea).toContainElement(breadcrumb);
  });

  it("does not duplicate the current root child in the breadcrumb", async () => {
    const user = await renderPlanner();
    const tree = screen.getByRole("tree", { name: "여행 일정" });

    await user.click(within(tree).getByRole("button", { name: "제주도 펼치기" }));

    const scrollArea = screen.getByTestId("planner-schedule-scroll-area");
    mockPlannerRowTops(
      tree,
      scrollArea,
      new Map([
        ["가보고 싶은 곳", -20],
        ["제주도", 20],
        ["8월 12일", 60],
      ]),
    );

    fireEvent.scroll(scrollArea);

    expect(screen.queryByRole("navigation", { name: "현재 일정 경로" })).not.toBeInTheDocument();
    expect(within(tree).getAllByText("제주도")).toHaveLength(1);
  });

  it("ends the previous breadcrumb at the next root branch boundary", async () => {
    const user = await renderPlanner();
    const tree = screen.getByRole("tree", { name: "여행 일정" });

    await user.click(within(tree).getByRole("button", { name: "제주도 펼치기" }));

    const scrollArea = screen.getByTestId("planner-schedule-scroll-area");
    mockPlannerRowTops(
      tree,
      scrollArea,
      new Map([
        ["가보고 싶은 곳", -300],
        ["제주도", -250],
        ["8월 12일", -180],
        ["8월 13일", -80],
        ["8월 14일", 20],
        ["서귀포", 60],
      ]),
    );

    fireEvent.scroll(scrollArea);

    expect(screen.queryByRole("navigation", { name: "현재 일정 경로" })).not.toBeInTheDocument();
    expect(screen.getByTestId("planner-root-boundary-label")).toHaveTextContent("제주도");
  });

  it("shows intermediate descendants and folders as visual shift-selection context", async () => {
    const user = await renderPlanner();
    const tree = screen.getByRole("tree", { name: "여행 일정" });

    await user.click(within(tree).getByRole("button", { name: "제주도 펼치기" }));
    await user.click(within(tree).getByRole("button", { name: "8월 13일 펼치기" }));
    await user.click(within(tree).getByRole("button", { name: "서귀포 펼치기" }));

    await user.click(within(tree).getByRole("button", { name: "8월 12일" }));
    await user.keyboard("{Shift>}");
    await user.click(within(tree).getByRole("button", { name: "8월 17일" }));
    await user.keyboard("{/Shift}");

    expect(within(tree).getByText("제주도").closest("[role=treeitem]")).toHaveAttribute(
      "data-selection-state",
      "selected",
    );
    expect(within(tree).getByText("8월 13일").closest("[role=treeitem]")).toHaveAttribute(
      "data-selection-state",
      "range",
    );
    expect(within(tree).getByText("비자림").closest("[role=treeitem]")).toHaveAttribute(
      "data-selection-state",
      "range",
    );
    expect(within(tree).getByText("서귀포").closest("[role=treeitem]")).toHaveAttribute(
      "data-selection-state",
      "range",
    );
    expect(within(tree).getByText("8월 18일").closest("[role=treeitem]")).not.toHaveAttribute(
      "data-selection-state",
    );
  });

  it("strongly highlights a complete branch only at its normalized parent", async () => {
    const user = await renderPlanner();
    const tree = screen.getByRole("tree", { name: "여행 일정" });

    await user.click(within(tree).getByRole("button", { name: "제주도 펼치기" }));

    await user.click(within(tree).getByRole("button", { name: "8월 12일" }));
    await user.keyboard("{Shift>}");
    await user.click(within(tree).getByRole("button", { name: "8월 14일" }));
    await user.keyboard("{/Shift}");

    expect(within(tree).getByText("제주도").closest("[role=treeitem]")).toHaveAttribute(
      "data-selection-state",
      "selected",
    );
    expect(within(tree).getByText("8월 12일").closest("[role=treeitem]")).toHaveAttribute(
      "data-selection-state",
      "range",
    );
    expect(within(tree).getByText("8월 14일").closest("[role=treeitem]")).toHaveAttribute(
      "data-selection-state",
      "range",
    );

    await user.click(within(tree).getByRole("button", { name: "8월 13일 펼치기" }));

    expect(within(tree).getByText("비자림").closest("[role=treeitem]")).toHaveAttribute(
      "data-selection-state",
      "range",
    );
    expect(within(tree).getByText("비자림").closest("[role=treeitem]")).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(within(tree).getByText("세화해변").closest("[role=treeitem]")).toHaveAttribute(
      "data-selection-state",
      "range",
    );
    expect(within(tree).getByText("제주도").closest("[role=treeitem]")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("switches the placeholder module and collapses and restores the panel", async () => {
    const user = await renderPlanner();

    await user.click(screen.getByRole("button", { name: "채팅" }));
    expect(screen.getByRole("heading", { name: "여행 채팅을 준비 중입니다" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "보조 패널 접기" }));
    expect(
      screen.queryByRole("complementary", { name: "Planner 보조 패널" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "패널 열기" }));
    expect(screen.getByRole("complementary", { name: "Planner 보조 패널" })).toBeInTheDocument();
  });
});
