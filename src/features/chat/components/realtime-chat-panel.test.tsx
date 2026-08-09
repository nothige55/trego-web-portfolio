import { describe, expect, it, vi } from "vitest";

import { RealtimeChatPanel } from "@/features/chat/components/realtime-chat-panel";
import { render, screen, userEvent } from "@/testing/test-utils";

describe("RealtimeChatPanel", () => {
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
        onLogout={vi.fn()}
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
        onLogout={vi.fn()}
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
        onLogout={vi.fn()}
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
        onLogout={vi.fn()}
        onSend={onSend}
      />,
    );

    await user.type(screen.getByRole("textbox", { name: "채팅 메시지" }), "전송 완료");
    await user.click(screen.getByRole("button", { name: "메시지 보내기" }));

    expect(screen.getByRole("textbox", { name: "채팅 메시지" })).toHaveValue("");
  });
});
