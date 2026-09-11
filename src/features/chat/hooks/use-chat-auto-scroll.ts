// 새 메시지를 자동으로 따라감
// 사용자가 위쪽 기록을 읽는 중이라면 따라가지 않도록 바닥 근처인지를 스크롤마다 기억

import { useCallback, useLayoutEffect, useRef } from "react";

const CHAT_BOTTOM_THRESHOLD = 24;

function isNearChatBottom(element: HTMLDivElement): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= CHAT_BOTTOM_THRESHOLD;
}

export type ChatAutoScroll = {
  readonly latestMessageRef: React.RefObject<HTMLDivElement | null>;
  readonly handleScroll: (event: React.UIEvent<HTMLDivElement>) => void;
  readonly scrollToLatest: (behavior: ScrollBehavior) => void;
};

export function useChatAutoScroll({
  historyStatus,
  latestMessageId,
}: {
  readonly historyStatus: "error" | "loading" | "ready";
  readonly latestMessageId: number | string | null;
}): ChatAutoScroll {
  const latestMessageRef = useRef<HTMLDivElement>(null);
  const hasPositionedInitiallyRef = useRef(false);
  const shouldFollowLatestRef = useRef(true);

  const scrollToLatest = useCallback((behavior: ScrollBehavior) => {
    const latestMessage = latestMessageRef.current;
    if (typeof latestMessage?.scrollIntoView === "function") {
      latestMessage.scrollIntoView({ behavior, block: "end" });
    }
    shouldFollowLatestRef.current = true;
  }, []);

  useLayoutEffect(() => {
    if (historyStatus === "loading") {
      return;
    }

    if (!hasPositionedInitiallyRef.current) {
      hasPositionedInitiallyRef.current = true;
      scrollToLatest("auto");
      return;
    }

    if (shouldFollowLatestRef.current) {
      scrollToLatest("smooth");
    }
  }, [historyStatus, latestMessageId, scrollToLatest]);

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    shouldFollowLatestRef.current = isNearChatBottom(event.currentTarget);
  }, []);

  return { latestMessageRef, handleScroll, scrollToLatest };
}
