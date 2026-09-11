import { describe, expect, it, vi } from "vitest";

import { MockPlaceExplorer } from "@/features/places/components/mock-place-explorer";
import type { PlaceAddTarget } from "@/features/places/types/mock-place";
import { render, screen, userEvent } from "@/testing/test-utils";

const targets: readonly PlaceAddTarget[] = [
  { id: "day-1", label: "8월 12일", color: "#F44336", group: "day" },
  { id: "day-2", label: "8월 13일", color: "#2196F3", group: "day" },
  { id: "wish", label: "가보고 싶은 곳", color: null, group: "wish" },
];

describe("MockPlaceExplorer", () => {
  it("filters mock places and keeps schedule creation disabled until a handler is provided", async () => {
    const user = userEvent.setup();
    render(<MockPlaceExplorer />);

    await user.type(screen.getByRole("textbox", { name: "장소 검색" }), "숲");

    expect(screen.getByText("검색 결과 1개")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /비자림/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /성산일출봉/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /비자림/ }));

    expect(screen.getByRole("heading", { name: "비자림" })).toBeInTheDocument();
    expect(screen.getByText("제주특별자치도 제주시 구좌읍 비자숲길 55")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "일정에 추가" })).toBeDisabled();
    expect(
      screen.getByText("실시간 연결이 준비되면 일정에 추가할 수 있습니다."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "검색 결과" }));
    expect(screen.getByRole("textbox", { name: "장소 검색" })).toHaveValue("숲");
  });

  it("adds the selected place to the chosen day and confirms it", async () => {
    const user = userEvent.setup();
    const onAddPlace = vi.fn().mockResolvedValue(undefined);
    render(<MockPlaceExplorer addTargets={targets} onAddPlace={onAddPlace} />);

    await user.click(screen.getByRole("button", { name: /성산일출봉/ }));
    await user.click(screen.getByRole("button", { name: "일정에 추가" }));

    expect(await screen.findByRole("group", { name: "날짜" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "가보고 싶은 곳" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "8월 13일" }));

    expect(onAddPlace).toHaveBeenCalledWith(
      expect.objectContaining({ name: "성산일출봉", latitude: 33.4581, longitude: 126.9425 }),
      targets[1],
    );
    expect(await screen.findByRole("status")).toHaveTextContent("8월 13일에 추가했습니다.");
  });

  it("marks the day currently viewed in the schedule among the targets", async () => {
    const user = userEvent.setup();
    render(<MockPlaceExplorer addTargets={targets} currentTargetId="day-2" onAddPlace={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /비자림/ }));
    await user.click(screen.getByRole("button", { name: "일정에 추가" }));

    expect(await screen.findByRole("button", { name: "8월 13일" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("button", { name: "8월 12일" })).not.toHaveAttribute("aria-current");
  });

  it("shows the failure message when adding the place fails", async () => {
    const user = userEvent.setup();
    const onAddPlace = vi.fn().mockRejectedValue(new Error("일정 추가에 실패했습니다."));
    render(<MockPlaceExplorer addTargets={targets} onAddPlace={onAddPlace} />);

    await user.click(screen.getByRole("button", { name: /협재해수욕장/ }));
    await user.click(screen.getByRole("button", { name: "일정에 추가" }));
    await user.click(await screen.findByRole("button", { name: "8월 12일" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("일정 추가에 실패했습니다.");
    expect(screen.getByRole("button", { name: "일정에 추가" })).toBeEnabled();
  });

  it("explains that a day is needed when there is nowhere to add the place", async () => {
    const user = userEvent.setup();
    render(<MockPlaceExplorer addTargets={[]} onAddPlace={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /비자림/ }));
    await user.click(screen.getByRole("button", { name: "일정에 추가" }));

    expect(
      await screen.findByText("장소를 넣을 날짜가 없습니다. 일정에서 날짜를 먼저 추가해 주세요."),
    ).toBeInTheDocument();
  });
});
