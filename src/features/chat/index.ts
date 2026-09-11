// 채팅 feature의 메시지 타입, Hub 계약, 메시지 병합 유틸을 한곳에서 내보냄
// 컴포넌트와 REST api는 포함하지 않아 app은 이들을 직접 경로로 import

export {
  CHAT_HUB_EVENTS,
  CHAT_HUB_METHODS,
  type ChatMessageSubscriptionActions,
  createSendChatMessageCommand,
  type SendChatMessageActions,
  type SendChatMessageResult,
  subscribeToChatMessages,
} from "@/features/chat/realtime/chat-realtime";
export type {
  ChatMessage,
  ChatMessageDraft,
  OnMessageReceivedHubEvent,
  SendMessageHubRequest,
} from "@/features/chat/types/chat-message";
export {
  dedupeChatMessages,
  mergeChatMessages,
  replaceChatMessagesFromHistory,
} from "@/features/chat/utils/chat-message-collection";
