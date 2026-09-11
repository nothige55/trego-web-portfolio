// 채팅 메시지 도메인 타입과 Hub 요청·수신 이벤트 payload 타입을 함께 둠
// 서버가 요구하는 PascalCase 필드는 SendMessageHubRequest에만 남김

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
