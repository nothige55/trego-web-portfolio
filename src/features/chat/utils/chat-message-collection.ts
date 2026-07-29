import type { ChatMessage } from "@/features/chat/types/chat-message";

export function dedupeChatMessages(messages: readonly ChatMessage[]): readonly ChatMessage[] {
  const uniqueMessages: ChatMessage[] = [];
  const indexByMessageId = new Map<ChatMessage["messageId"], number>();

  for (const message of messages) {
    const existingIndex = indexByMessageId.get(message.messageId);

    if (existingIndex === undefined) {
      indexByMessageId.set(message.messageId, uniqueMessages.length);
      uniqueMessages.push(message);
      continue;
    }

    uniqueMessages[existingIndex] = message;
  }

  return uniqueMessages;
}

export function replaceChatMessagesFromHistory(
  history: readonly ChatMessage[],
): readonly ChatMessage[] {
  return dedupeChatMessages(history);
}

export function mergeChatMessages(
  currentMessages: readonly ChatMessage[],
  incomingMessages: readonly ChatMessage[],
): readonly ChatMessage[] {
  return dedupeChatMessages([...currentMessages, ...incomingMessages]);
}
