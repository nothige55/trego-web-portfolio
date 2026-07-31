import { describe, expect, it, vi } from "vitest";

import { RealtimeChatPanel } from "@/features/chat/components/realtime-chat-panel";
import { render, screen, userEvent } from "@/testing/test-utils";

describe("RealtimeChatPanel", () => {
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
