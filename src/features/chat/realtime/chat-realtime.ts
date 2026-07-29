import type {
  ChatMessageDraft,
  OnMessageReceivedHubEvent,
  SendMessageHubRequest,
} from "@/features/chat/types/chat-message";
import type { SignalRClient } from "@/lib/signalr-client";

export const CHAT_HUB_METHODS = {
  sendMessage: "SendMessage",
} as const;

export const CHAT_HUB_EVENTS = {
  messageReceived: "OnMessageReceived",
} as const;

export interface ChatMessageSubscriptionActions {
  readonly onMessageReceived: (message: OnMessageReceivedHubEvent) => void;
}

export interface SendChatMessageActions {
  readonly onSending?: (draft: ChatMessageDraft) => void;
  readonly onSent?: (draft: ChatMessageDraft) => void;
  readonly onFailed?: (draft: ChatMessageDraft, error: Error) => void;
}

export type SendChatMessageResult =
  | {
      readonly status: "sent";
      readonly draft: ChatMessageDraft;
    }
  | {
      readonly status: "failed";
      readonly draft: ChatMessageDraft;
      readonly error: Error;
    };

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function toSendMessageRequest(draft: ChatMessageDraft): SendMessageHubRequest {
  return {
    MemberId: draft.memberId,
    ProjectId: draft.projectId,
    Content: draft.content,
    Type: "member",
  };
}

export function subscribeToChatMessages(
  client: SignalRClient,
  { onMessageReceived }: ChatMessageSubscriptionActions,
): () => void {
  return client.on<[OnMessageReceivedHubEvent]>(CHAT_HUB_EVENTS.messageReceived, onMessageReceived);
}

export function createSendChatMessageCommand(
  client: SignalRClient,
  { onFailed, onSending, onSent }: SendChatMessageActions = {},
): (draft: ChatMessageDraft) => Promise<SendChatMessageResult> {
  return async (draft) => {
    onSending?.(draft);

    try {
      await client.invoke<void>(CHAT_HUB_METHODS.sendMessage, toSendMessageRequest(draft));
      onSent?.(draft);

      return { status: "sent", draft };
    } catch (error) {
      const sendError = toError(error);
      onFailed?.(draft, sendError);

      return { status: "failed", draft, error: sendError };
    }
  };
}
