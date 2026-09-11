// 채팅 메시지 목록을 messageId 기준으로 중복 제거·병합하는 순수 함수
// 같은 ID는 처음 위치를 유지한 채 나중 payload로 덮으므로 echo와 재조회를 반복 적용해도 결과가 같음

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
