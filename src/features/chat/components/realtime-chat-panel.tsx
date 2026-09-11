// 채팅 영역의 배치와 멤버 추가 영역의 열림 상태를 담당
// 목록·입력창은 각자 상태를 소유하고, 이 컴포넌트는 정렬된 메시지와 스크롤 추종만 이어 줌

import { UserPlus } from "lucide-react";
import { type ReactNode, useCallback, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { ChatMessage, SendChatMessageResult } from "@/features/chat";
import { ChatMessageComposer } from "@/features/chat/components/chat-message-composer";
import { ChatMessageList } from "@/features/chat/components/chat-message-list";
import { useChatAutoScroll } from "@/features/chat/hooks/use-chat-auto-scroll";

type RealtimeChatPanelProps = {
  readonly currentUserId: string;
  readonly currentUserName: string;
  readonly historyStatus?: "error" | "loading" | "ready";
  readonly isReady: boolean;
  readonly memberInviteContent?: ReactNode;
  readonly messages: readonly ChatMessage[];
  readonly onRetryHistory?: () => void;
  readonly onSend: (content: string) => Promise<SendChatMessageResult>;
};

export function RealtimeChatPanel({
  currentUserId,
  currentUserName,
  historyStatus = "ready",
  isReady,
  memberInviteContent,
  messages,
  onRetryHistory,
  onSend,
}: RealtimeChatPanelProps) {
  const [isMemberInviteOpen, setIsMemberInviteOpen] = useState(false);
  const sortedMessages = useMemo(
    () => [...messages].sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    [messages],
  );
  const { handleScroll, latestMessageRef, scrollToLatest } = useChatAutoScroll({
    historyStatus,
    latestMessageId: sortedMessages.at(-1)?.messageId ?? null,
  });
  const handleSend = useCallback(
    (content: string): Promise<SendChatMessageResult> => {
      scrollToLatest("smooth");
      return onSend(content);
    },
    [onSend, scrollToLatest],
  );

  return (
    <section aria-label="프로젝트 실시간 채팅" className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex min-w-0 items-center justify-between gap-2 border-b px-1 pb-3">
        <p className="min-w-0 truncate text-sm font-semibold">{currentUserName}</p>
        <div className="flex shrink-0 items-center gap-1">
          {memberInviteContent ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-expanded={isMemberInviteOpen}
              onClick={() => setIsMemberInviteOpen((isOpen) => !isOpen)}
            >
              <UserPlus aria-hidden="true" className="size-4" />
              멤버 추가
            </Button>
          ) : null}
        </div>
      </div>
      {isMemberInviteOpen ? memberInviteContent : null}

      <ChatMessageList
        currentUserId={currentUserId}
        historyStatus={historyStatus}
        latestMessageRef={latestMessageRef}
        messages={sortedMessages}
        onRetryHistory={onRetryHistory}
        onScroll={handleScroll}
      />

      <ChatMessageComposer isReady={isReady} onSend={handleSend} />
    </section>
  );
}
