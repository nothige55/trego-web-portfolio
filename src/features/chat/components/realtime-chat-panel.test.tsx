import { fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RealtimeChatPanel } from "@/features/chat/components/realtime-chat-panel";
import { render, screen, userEvent } from "@/testing/test-utils";

describe("RealtimeChatPanel", () => {
  const scrollIntoView = vi.fn();

  beforeEach(() => {
    scrollIntoView.mockReset();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
  });

  it("hides member ids and keeps the invite form collapsed until requested", async () => {
    const user = userEvent.setup();
    render(
      <RealtimeChatPanel
        currentUserId="11111111-1111-1111-1111-111111111111"
        currentUserName="테스터"
        isReady
        memberInviteContent={<div>초대 폼</div>}
        messages={[
          {
            messageId: 1,
            memberId: "22222222-2222-2222-2222-222222222222",
            content: "안녕하세요",
            type: "member",
            createdAt: "2026-08-10T00:00:00Z",
          },
        ]}
        onSend={vi.fn()}
      />,
    );

    expect(screen.queryByText("11111111-1111-1111-1111-111111111111")).not.toBeInTheDocument();
    expect(screen.queryByText("22222222")).not.toBeInTheDocument();
    expect(screen.queryByText("초대 폼")).not.toBeInTheDocument();
    expect(screen.getByText("프로젝트 멤버")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "멤버 추가" }));

    expect(screen.getByText("초대 폼")).toBeInTheDocument();
  });

  it("shows a retry action when chat history cannot be loaded", async () => {
    const user = userEvent.setup();
    const onRetryHistory = vi.fn();
    render(
      <RealtimeChatPanel
        currentUserId="member-id"
        currentUserName="테스터"
        historyStatus="error"
        isReady={false}
        messages={[]}
        onRetryHistory={onRetryHistory}
        onSend={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "내역 다시 불러오기" }));

    expect(onRetryHistory).toHaveBeenCalledOnce();
  });

  it("keeps a failed message draft so the user can retry it", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue({
      status: "failed",
      draft: { memberId: "member-id", projectId: "project-id", content: "다시 보내기" },
      error: new Error("offline"),
    });
    render(
      <RealtimeChatPanel
        currentUserId="member-id"
        currentUserName="테스터"
        isReady
        messages={[]}
        onSend={onSend}
      />,
    );

    await user.type(screen.getByRole("textbox", { name: "채팅 메시지" }), "다시 보내기");
    await user.click(screen.getByRole("button", { name: "메시지 보내기" }));

    expect(onSend).toHaveBeenCalledWith("다시 보내기");
    expect(screen.getByRole("textbox", { name: "채팅 메시지" })).toHaveValue("다시 보내기");
    expect(screen.getByRole("alert")).toHaveTextContent("다시 시도");
  });

  it("clears the draft only after the server command succeeds", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue({
      status: "sent",
      draft: { memberId: "member-id", projectId: "project-id", content: "전송 완료" },
    });
    render(
      <RealtimeChatPanel
        currentUserId="member-id"
        currentUserName="테스터"
        isReady
        messages={[]}
        onSend={onSend}
      />,
    );

    await user.type(screen.getByRole("textbox", { name: "채팅 메시지" }), "전송 완료");
    await user.click(screen.getByRole("button", { name: "메시지 보내기" }));

    expect(screen.getByRole("textbox", { name: "채팅 메시지" })).toHaveValue("");
  });

  it("starts at the latest message and hides the scrollbar", () => {
    render(
      <RealtimeChatPanel
        currentUserId="member-id"
        currentUserName="테스터"
        isReady
        messages={[
          {
            messageId: 1,
            memberId: "other-member-id",
            content: "첫 메시지",
            type: "member",
            createdAt: "2026-08-10T00:00:00Z",
          },
        ]}
        onSend={vi.fn()}
      />,
    );

    expect(screen.getByRole("log")).toHaveClass("scrollbar-hide");
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "end" });
  });

  it("follows incoming messages only while the user remains near the bottom", () => {
    const baseProps = {
      currentUserId: "member-id",
      currentUserName: "테스터",
      isReady: true,
      onSend: vi.fn(),
    };
    const firstMessage = {
      messageId: 1,
      memberId: "other-member-id",
      content: "첫 메시지",
      type: "member" as const,
      createdAt: "2026-08-10T00:00:00Z",
    };
    const secondMessage = {
      ...firstMessage,
      messageId: 2,
      content: "두 번째 메시지",
      createdAt: "2026-08-10T00:01:00Z",
    };
    const thirdMessage = {
      ...firstMessage,
      messageId: 3,
      content: "세 번째 메시지",
      createdAt: "2026-08-10T00:02:00Z",
    };
    const { rerender } = render(<RealtimeChatPanel {...baseProps} messages={[firstMessage]} />);

    scrollIntoView.mockClear();
    rerender(<RealtimeChatPanel {...baseProps} messages={[firstMessage, secondMessage]} />);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "end" });

    const messageLog = screen.getByRole("log");
    Object.defineProperties(messageLog, {
      clientHeight: { configurable: true, value: 200 },
      scrollHeight: { configurable: true, value: 1000 },
      scrollTop: { configurable: true, value: 200 },
    });
    fireEvent.scroll(messageLog);
    scrollIntoView.mockClear();

    rerender(
      <RealtimeChatPanel {...baseProps} messages={[firstMessage, secondMessage, thirdMessage]} />,
    );
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("returns to the latest message when sending while scrolled up", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue({
      status: "sent",
      draft: { memberId: "member-id", projectId: "project-id", content: "새 메시지" },
    });
    render(
      <RealtimeChatPanel
        currentUserId="member-id"
        currentUserName="테스터"
        isReady
        messages={[]}
        onSend={onSend}
      />,
    );

    const messageLog = screen.getByRole("log");
    Object.defineProperties(messageLog, {
      clientHeight: { configurable: true, value: 200 },
      scrollHeight: { configurable: true, value: 1000 },
      scrollTop: { configurable: true, value: 100 },
    });
    fireEvent.scroll(messageLog);
    scrollIntoView.mockClear();

    await user.type(screen.getByRole("textbox", { name: "채팅 메시지" }), "새 메시지");
    await user.click(screen.getByRole("button", { name: "메시지 보내기" }));

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "end" });
  });
});
