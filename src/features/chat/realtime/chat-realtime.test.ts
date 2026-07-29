import { describe, expect, it, vi } from "vitest";

import {
  CHAT_HUB_EVENTS,
  CHAT_HUB_METHODS,
  createSendChatMessageCommand,
  subscribeToChatMessages,
} from "@/features/chat/realtime/chat-realtime";
import type {
  ChatMessageDraft,
  OnMessageReceivedHubEvent,
} from "@/features/chat/types/chat-message";
import type { SignalRClient } from "@/lib/signalr-client";

function createClientMock() {
  const invoke = vi.fn();
  const on = vi.fn();
  const client: SignalRClient = {
    getStatus: vi.fn(() => "connected" as const),
    invoke: invoke as SignalRClient["invoke"],
    on: on as SignalRClient["on"],
    start: vi.fn<SignalRClient["start"]>(),
    stop: vi.fn<SignalRClient["stop"]>(),
    subscribeStatus: vi.fn<SignalRClient["subscribeStatus"]>(),
  };

  return { client, invoke, on };
}

const draft: ChatMessageDraft = {
  memberId: "member-id",
  projectId: "project-id",
  content: "Keep this exact draft",
};

describe("chat message subscription", () => {
  it("registers and returns the SignalR unsubscribe action", () => {
    const { client, on } = createClientMock();
    const unsubscribe = vi.fn();
    const onMessageReceived = vi.fn();
    on.mockReturnValue(unsubscribe);

    const result = subscribeToChatMessages(client, { onMessageReceived });

    expect(on).toHaveBeenCalledWith(CHAT_HUB_EVENTS.messageReceived, onMessageReceived);
    expect(result).toBe(unsubscribe);
  });

  it("forwards the typed server event without owning chat state", () => {
    const { client, on } = createClientMock();
    let registeredHandler: ((message: OnMessageReceivedHubEvent) => void) | undefined;
    on.mockImplementation((_eventName, handler) => {
      registeredHandler = handler as (message: OnMessageReceivedHubEvent) => void;
      return vi.fn();
    });
    const onMessageReceived = vi.fn();
    const event: OnMessageReceivedHubEvent = {
      messageId: 12,
      memberId: "member-id",
      projectId: "project-id",
      content: "hello",
      type: "member",
      createdAt: "2026-07-29T12:00:00Z",
    };

    subscribeToChatMessages(client, { onMessageReceived });
    registeredHandler?.(event);

    expect(onMessageReceived).toHaveBeenCalledWith(event);
  });
});

describe("createSendChatMessageCommand", () => {
  it("sends the existing backend payload and reports success without appending a message", async () => {
    const { client, invoke } = createClientMock();
    invoke.mockResolvedValue(undefined);
    const onSending = vi.fn();
    const onSent = vi.fn();
    const onFailed = vi.fn();
    const sendMessage = createSendChatMessageCommand(client, { onSending, onSent, onFailed });

    const result = await sendMessage(draft);

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith(CHAT_HUB_METHODS.sendMessage, {
      MemberId: "member-id",
      ProjectId: "project-id",
      Content: "Keep this exact draft",
      Type: "member",
    });
    expect(onSending).toHaveBeenCalledWith(draft);
    expect(onSent).toHaveBeenCalledWith(draft);
    expect(onFailed).not.toHaveBeenCalled();
    expect(result).toEqual({ status: "sent", draft });
  });

  it("returns the failed draft, reports the error, and does not retry", async () => {
    const { client, invoke } = createClientMock();
    const error = new Error("connection lost");
    invoke.mockRejectedValue(error);
    const onSending = vi.fn();
    const onSent = vi.fn();
    const onFailed = vi.fn();
    const sendMessage = createSendChatMessageCommand(client, { onSending, onSent, onFailed });

    const result = await sendMessage(draft);

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(onSending).toHaveBeenCalledWith(draft);
    expect(onSent).not.toHaveBeenCalled();
    expect(onFailed).toHaveBeenCalledWith(draft, error);
    expect(result).toEqual({ status: "failed", draft, error });
  });
});
