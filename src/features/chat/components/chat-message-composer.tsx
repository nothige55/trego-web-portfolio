import { Send } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import type { SendChatMessageResult } from "@/features/chat";

// 입력 초안과 전송 결과를 소유한다.
// 실패해도 초안을 지우지 않고 오류만 남겨 사용자가 그대로 다시 보낼 수 있게 한다.
export function ChatMessageComposer({
  isReady,
  onSend,
}: {
  readonly isReady: boolean;
  readonly onSend: (content: string) => Promise<SendChatMessageResult>;
}) {
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
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
  );
}
