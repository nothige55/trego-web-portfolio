// 메시지 목록과 그 자리를 대신하는 로딩·오류·빈 상태를 함께 담당

import { LoaderCircle, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ChatMessage } from "@/features/chat";
import { ChatMessageBubble } from "@/features/chat/components/chat-message-bubble";

export function ChatMessageList({
  currentUserId,
  historyStatus,
  latestMessageRef,
  messages,
  onRetryHistory,
  onScroll,
}: {
  readonly currentUserId: string;
  readonly historyStatus: "error" | "loading" | "ready";
  readonly latestMessageRef: React.RefObject<HTMLDivElement | null>;
  readonly messages: readonly ChatMessage[];
  readonly onRetryHistory?: () => void;
  readonly onScroll: (event: React.UIEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      className="scrollbar-hide min-h-0 flex-1 space-y-3 overflow-y-auto py-4"
      onScroll={onScroll}
    >
      {historyStatus === "loading" && messages.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center px-6 text-center">
          <LoaderCircle aria-hidden="true" className="size-7 animate-spin text-brand" />
          <p className="mt-3 text-sm font-medium">채팅 내역을 불러오는 중입니다</p>
        </div>
      ) : historyStatus === "error" && messages.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center px-6 text-center">
          <UserRound aria-hidden="true" className="size-7 text-destructive" />
          <p className="mt-3 text-sm font-medium">채팅 내역을 불러오지 못했습니다</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            로그인 상태와 백엔드 연결을 확인한 뒤 다시 시도해 주세요.
          </p>
          {onRetryHistory ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={onRetryHistory}
            >
              내역 다시 불러오기
            </Button>
          ) : null}
        </div>
      ) : messages.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center px-6 text-center">
          <UserRound aria-hidden="true" className="size-7 text-brand" />
          <p className="mt-3 text-sm font-medium">아직 메시지가 없습니다</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            같은 프로젝트를 연 다른 브라우저에 메시지를 보내 보세요.
          </p>
        </div>
      ) : (
        messages.map((message) => (
          <ChatMessageBubble
            key={message.messageId}
            isMine={message.memberId === currentUserId}
            message={message}
          />
        ))
      )}
      <div ref={latestMessageRef} aria-hidden="true" />
    </div>
  );
}
