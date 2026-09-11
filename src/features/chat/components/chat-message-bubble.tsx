// 보낸 사람에 따라 좌우가 갈리는 말풍선 하나

import type { ChatMessage } from "@/features/chat";

function formatMessageTime(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
}

export function ChatMessageBubble({
  isMine,
  message,
}: {
  readonly isMine: boolean;
  readonly message: ChatMessage;
}) {
  return (
    <article className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
      <p className="mb-1 px-1 text-[11px] text-muted-foreground">
        {isMine ? "나" : (message.memberName ?? "프로젝트 멤버")}
      </p>
      <div
        className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-5 [overflow-wrap:anywhere] ${
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
}
