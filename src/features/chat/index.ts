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
