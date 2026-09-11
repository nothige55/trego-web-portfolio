import { afterEach, describe, expect, it, vi } from "vitest";

import { DemoPlannerPage } from "@/app/demo/demo-planner-page";
import { usePlannerViewStore } from "@/features/planner/stores/planner-view-store";
import { render, screen, userEvent, waitFor, within } from "@/testing/test-utils";

vi.mock("@/features/planner/components/planner-map", () => ({
  PlannerMap: () => <section aria-label="지도 영역" />,
}));

describe("DemoPlannerPage", () => {
  afterEach(() => {
    usePlannerViewStore.getState().reset();
  });

  it("opens an editable schedule without login and recovers from a dropped connection", async () => {
    const user = userEvent.setup();
    render(<DemoPlannerPage />);

    const panel = screen.getByRole("complementary", { name: "데모 안내" });
    await user.click(within(panel).getByRole("button", { name: "민지 멈추기" }));

    expect(
      await screen.findByRole("heading", { name: "제주도 7일 여행" }, { timeout: 3_000 }),
    ).toBeInTheDocument();
    expect(await screen.findByText("동문시장")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText("실시간 연결 중입니다.")).not.toBeInTheDocument(),
    );

    await user.click(within(panel).getByRole("button", { name: "연결 끊기" }));
    expect(await screen.findByText("실시간 연결을 복구하고 있습니다.")).toBeInTheDocument();
    expect(within(panel).getByRole("status")).toHaveTextContent("놓친 변경을 서버에서 다시");

    await user.click(within(panel).getByRole("button", { name: "다시 연결" }));
    await waitFor(
      () => expect(screen.queryByText("실시간 연결을 복구하고 있습니다.")).not.toBeInTheDocument(),
      { timeout: 3_000 },
    );
    expect(await screen.findByText("동문시장", undefined, { timeout: 3_000 })).toBeInTheDocument();
  });
});
