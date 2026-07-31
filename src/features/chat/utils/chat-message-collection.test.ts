import { describe, expect, it } from "vitest";

import type { ChatMessage } from "@/features/chat/types/chat-message";
import {
  dedupeChatMessages,
  mergeChatMessages,
  replaceChatMessagesFromHistory,
} from "@/features/chat/utils/chat-message-collection";

function createMessage(messageId: number, content: string): ChatMessage {
  return {
    messageId,
    memberId: "member-id",
    content,
    type: "member",
    createdAt: "2026-07-29T12:00:00Z",
  };
}

describe("chat message collection", () => {
  it("deduplicates initial REST history by messageId and keeps the latest payload", () => {
    const first = createMessage(1, "stale");
    const second = createMessage(2, "second");
    const updatedFirst = createMessage(1, "canonical");

    expect(dedupeChatMessages([first, second, updatedFirst])).toEqual([updatedFirst, second]);
  });

  it("replaces stale local messages with deduplicated reconnect history", () => {
    const staleLocalMessages = [createMessage(1, "stale"), createMessage(99, "missed locally")];
    const reconnectHistory = [
      createMessage(1, "canonical"),
      createMessage(2, "new from server"),
      createMessage(2, "newest server copy"),
    ];

    const replacement = replaceChatMessagesFromHistory(reconnectHistory);

    expect(staleLocalMessages).toHaveLength(2);
    expect(replacement).toEqual([
      createMessage(1, "canonical"),
      createMessage(2, "newest server copy"),
    ]);
  });

  it("merges sender echoes and repeated events idempotently", () => {
    const current = [createMessage(1, "first")];
    const senderEcho = createMessage(2, "sent once");
    const updatedEvent = createMessage(1, "updated payload");

    const once = mergeChatMessages(current, [senderEcho]);
    const repeated = mergeChatMessages(once, [senderEcho, updatedEvent]);

    expect(repeated).toEqual([updatedEvent, senderEcho]);
    expect(current).toEqual([createMessage(1, "first")]);
  });
});
