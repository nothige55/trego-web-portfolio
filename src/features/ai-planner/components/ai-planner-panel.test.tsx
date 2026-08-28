import { beforeEach, describe, expect, it, vi } from "vitest";

import { AiPlannerPanel } from "@/features/ai-planner/components/ai-planner-panel";
import { render, screen, userEvent, within } from "@/testing/test-utils";

const seongsan = {
  kind: "activity",
  name: "성산일출봉",
  pathId: "activity-seongsan",
  memo: "일출 보기",
  startTime: "07:00",
  endTime: "08:30",
} as const;

async function sendPrompt(user: ReturnType<typeof userEvent.setup>, prompt: string) {
  await user.type(screen.getByRole("textbox", { name: "AI 플래너에게 메시지" }), prompt);
  await user.click(screen.getByRole("button", { name: "AI 플래너에게 보내기" }));
  return screen.findByRole("region", { name: "AI 일정 변경 제안" });
}

describe("AiPlannerPanel", () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  });

  it("captures the selected Activity as context and returns a reviewable mock proposal", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<AiPlannerPanel contextItems={[seongsan]} />);

    expect(screen.getByLabelText("AI가 참고할 일정")).toHaveTextContent("성산일출봉");

    await user.type(
      screen.getByRole("textbox", { name: "AI 플래너에게 메시지" }),
      "오후 시간을 늦춰줘",
    );
    await user.click(screen.getByRole("button", { name: "AI 플래너에게 보내기" }));

    expect(screen.getByRole("status")).toHaveTextContent("문맥을 분석");
    const proposal = await screen.findByRole("region", { name: "AI 일정 변경 제안" });
    expect(within(proposal).getByText("성산일출봉 메모")).toBeInTheDocument();
    expect(within(proposal).getByText("성산일출봉 시간")).toBeInTheDocument();
    expect(within(proposal).getByRole("button", { name: "선택한 변경 적용" })).toBeDisabled();

    await user.click(within(proposal).getByRole("button", { name: "변경 전후 미리보기" }));
    expect(within(proposal).getByRole("status")).toHaveTextContent("적용 전 diff · 2건");
    // before는 스냅샷이 아니라 현재 문맥 값에서 만들어진다.
    expect(proposal).toHaveTextContent("일출 보기");
    expect(proposal).toHaveTextContent("07:00–08:30");
    expect(proposal).toHaveTextContent("14:00–15:30");
    expect(
      within(proposal).getByText("아직 Planner와 서버에는 반영되지 않았습니다."),
    ).toBeVisible();

    rerender(
      <AiPlannerPanel
        contextItems={[{ kind: "activity", name: "제주 동문시장", pathId: "activity-market" }]}
      />,
    );

    expect(screen.getByLabelText("AI가 참고할 일정")).toHaveTextContent("제주 동문시장");
    expect(screen.getByLabelText("이 메시지의 참고 일정")).toHaveTextContent("성산일출봉");
    expect(screen.getByLabelText("이 메시지의 참고 일정")).not.toHaveTextContent("제주 동문시장");

    await user.click(within(proposal).getByRole("button", { name: "변경안 거절" }));
    expect(within(proposal).getByRole("status")).toHaveTextContent(
      "이 변경안은 적용 대상에서 제외되었습니다.",
    );
    expect(within(proposal).queryByRole("button", { name: "선택한 변경 적용" })).toBeNull();
  });

  it("runs approved operations through the injected Planner executor", async () => {
    const user = userEvent.setup();
    const approve = vi.fn().mockResolvedValue(undefined);
    render(<AiPlannerPanel contextItems={[seongsan]} onApproveOperations={approve} />);

    const proposal = await sendPrompt(user, "메모를 정리해줘");
    await user.click(within(proposal).getByRole("button", { name: "선택한 변경 적용" }));

    expect(approve).toHaveBeenCalledTimes(1);
    expect(approve.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({
        type: "update-activity-memo",
        pathId: "activity-seongsan",
      }),
    ]);
    expect(await within(proposal).findByRole("status")).toHaveTextContent("변경을 적용했습니다");
    expect(within(proposal).queryByRole("button", { name: "선택한 변경 적용" })).toBeNull();
  });

  it("keeps the proposal retryable when applying the change fails", async () => {
    const user = userEvent.setup();
    const approve = vi.fn().mockRejectedValue(new Error("실시간 연결이 끊겼습니다."));
    render(<AiPlannerPanel contextItems={[seongsan]} onApproveOperations={approve} />);

    const proposal = await sendPrompt(user, "메모를 정리해줘");
    await user.click(within(proposal).getByRole("button", { name: "선택한 변경 적용" }));

    expect(await within(proposal).findByRole("alert")).toHaveTextContent(
      "실시간 연결이 끊겼습니다.",
    );

    await user.click(within(proposal).getByRole("button", { name: "다시 시도" }));
    expect(within(proposal).getByRole("button", { name: "선택한 변경 적용" })).toBeEnabled();
  });

  it("answers without a change proposal when no Activity is selected", async () => {
    const user = userEvent.setup();
    render(<AiPlannerPanel contextItems={[]} />);

    await user.type(
      screen.getByRole("textbox", { name: "AI 플래너에게 메시지" }),
      "교토 여행은 언제가 좋아?",
    );
    await user.click(screen.getByRole("button", { name: "AI 플래너에게 보내기" }));

    expect(await screen.findByText(/일정 선택 없이 일반 여행 질문/)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "AI 일정 변경 제안" })).not.toBeInTheDocument();
  });

  it("stops a pending mock response and starts a clean conversation", async () => {
    const user = userEvent.setup();
    render(<AiPlannerPanel contextItems={[]} />);

    await user.type(
      screen.getByRole("textbox", { name: "AI 플래너에게 메시지" }),
      "응답을 중단해줘",
    );
    await user.click(screen.getByRole("button", { name: "AI 플래너에게 보내기" }));
    await user.click(screen.getByRole("button", { name: "AI 응답 중단" }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "새 대화" }));
    expect(screen.queryByText("응답을 중단해줘")).not.toBeInTheDocument();
    expect(screen.getAllByText("AI 플래너").length).toBeGreaterThan(0);
  });
});
