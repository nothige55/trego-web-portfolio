import { Send, UserRound } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { ChatMessage, SendChatMessageResult } from "@/features/chat";

type RealtimeChatPanelProps = {
  readonly currentUserId: string;
  readonly currentUserName: string;
  readonly isReady: boolean;
  readonly messages: readonly ChatMessage[];
  readonly onLogout: () => void;
  readonly onSend: (content: string) => Promise<SendChatMessageResult>;
};

function formatMessageTime(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
}

export function RealtimeChatPanel({
  currentUserId,
  currentUserName,
  isReady,
  messages,
  onLogout,
  onSend,
}: RealtimeChatPanelProps) {
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const sortedMessages = useMemo(
    () => [...messages].sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    [messages],
  );
  const trimmedDraft = draft.trim();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!trimmedDraft || !isReady || isSending) {
      return;
    }

    setIsSending(true);
    setSendError(null);
    const result = await onSend(trimmedDraft);
    setIsSending(false);

    if (result.status === "sent") {
      setDraft("");
      return;
    }

    setSendError("메시지를 보내지 못했습니다. 연결을 확인하고 다시 시도해 주세요.");
  }

  return (
    <section aria-label="프로젝트 실시간 채팅" className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-3 border-b px-1 pb-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{currentUserName}</p>
          <p className="truncate text-xs text-muted-foreground">{currentUserId}</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onLogout}>
          테스트 로그아웃
        </Button>
      </div>

      <div aria-live="polite" className="min-h-0 flex-1 space-y-3 overflow-y-auto py-4">
        {sortedMessages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <UserRound aria-hidden="true" className="size-7 text-brand" />
            <p className="mt-3 text-sm font-medium">아직 메시지가 없습니다</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              같은 프로젝트를 연 다른 브라우저에 메시지를 보내 보세요.
            </p>
          </div>
        ) : (
          sortedMessages.map((message) => {
            const isMine = message.memberId === currentUserId;

            return (
              <article
                key={message.messageId}
                className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}
              >
                <p className="mb-1 px-1 text-[11px] text-muted-foreground">
                  {isMine ? "나" : (message.memberName ?? message.memberId.slice(0, 8))}
                </p>
                <div
                  className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-5 break-words ${
                    isMine
                      ? "rounded-br-md bg-brand text-brand-foreground"
                      : "rounded-bl-md bg-muted text-foreground"
                  }`}
                >
                  {message.content}
                </div>
                <time className="mt-1 px-1 text-[10px] text-muted-foreground">
                  {formatMessageTime(message.createdAt)}
                </time>
              </article>
            );
          })
        )}
      </div>

      <form className="border-t pt-3" onSubmit={handleSubmit}>
        <label htmlFor="realtime-chat-message" className="sr-only">
          채팅 메시지
        </label>
        <div className="flex items-end gap-2">
          <textarea
            id="realtime-chat-message"
            rows={2}
            value={draft}
            disabled={!isReady || isSending}
            placeholder={isReady ? "메시지를 입력하세요" : "실시간 연결을 기다리는 중입니다"}
            className="min-h-16 flex-1 resize-none rounded-xl border bg-background px-3 py-2 text-sm outline-none focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/15 disabled:cursor-not-allowed disabled:opacity-60"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <Button
            type="submit"
            size="icon-lg"
            aria-label="메시지 보내기"
            disabled={!isReady || !trimmedDraft || isSending}
            className="bg-brand text-brand-foreground hover:bg-brand-hover"
          >
            <Send aria-hidden="true" className="size-4" />
          </Button>
        </div>
        {sendError ? (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {sendError}
          </p>
        ) : null}
      </form>
    </section>
  );
}
