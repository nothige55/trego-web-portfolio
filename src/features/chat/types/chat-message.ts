export interface ChatMessage {
  readonly messageId: number;
  readonly memberId: string;
  readonly content: string;
  readonly type: string;
  readonly createdAt: string;
  readonly memberName?: string;
  readonly projectId?: string;
}

export interface ChatMessageDraft {
  readonly memberId: string;
  readonly projectId: string;
  readonly content: string;
}

export interface SendMessageHubRequest {
  readonly MemberId: string;
  readonly ProjectId: string;
  readonly Content: string;
  readonly Type: "member";
}

export interface OnMessageReceivedHubEvent extends ChatMessage {
  readonly projectId: string;
}
