import { Bot, LoaderCircle, Plus, Send, Sparkles, Square } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { mockAiPlannerClient } from "@/features/ai-planner/api/mock-ai-planner-client";
import { AiPlannerProposalCard } from "@/features/ai-planner/components/ai-planner-proposal-card";
import type {
  AiPlannerChatClient,
  AiPlannerContextItem,
  AiPlannerMessage,
  AiPlannerProposal,
  AiPlannerProposalToolPart,
} from "@/features/ai-planner/types/ai-planner";

type AiPlannerPanelProps = {
  readonly client?: AiPlannerChatClient;
  readonly contextItems: readonly AiPlannerContextItem[];
};

const welcomeMessage: AiPlannerMessage = {
  id: "ai-planner-welcome",
  role: "assistant",
  metadata: { createdAt: 0, source: "system" },
  parts: [
    {
      type: "text",
      text: "여행 일정에 관해 질문하거나 Planner 항목을 선택한 뒤 변경을 요청해 보세요. 변경은 검토와 승인 전에는 적용되지 않습니다.",
    },
  ],
};

function getMessageText(message: AiPlannerMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

export function AiPlannerPanel({
  client = mockAiPlannerClient,
  contextItems,
}: AiPlannerPanelProps) {
  const [messages, setMessages] = useState<readonly AiPlannerMessage[]>([welcomeMessage]);
  const [draft, setDraft] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const responseAbortRef = useRef<AbortController | null>(null);
  const latestMessageRef = useRef<HTMLDivElement>(null);
  const trimmedDraft = draft.trim();

  useEffect(() => () => responseAbortRef.current?.abort(), []);

  function stopGenerating() {
    responseAbortRef.current?.abort();
    responseAbortRef.current = null;
    setIsGenerating(false);
  }

  function resetConversation() {
    stopGenerating();
    setMessages([welcomeMessage]);
    setDraft("");
  }

  function rejectProposal(toolCallId: string) {
    setMessages((current) =>
      current.map((message) => ({
        ...message,
        parts: message.parts.map((part) => {
          if (
            part.type !== "tool-proposePlannerOperations" ||
            part.toolCallId !== toolCallId ||
            (part.state !== "approval-requested" && part.state !== "input-available")
          ) {
            return part;
          }

          return {
            type: "tool-proposePlannerOperations",
            toolCallId: part.toolCallId,
            state: "output-denied",
            input: part.input,
            approval: {
              id: `approval-${part.toolCallId}`,
              approved: false,
              reason: "사용자가 변경안을 거절했습니다.",
            },
          } satisfies AiPlannerProposalToolPart;
        }),
      })),
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trimmedDraft || isGenerating) return;

    const prompt = trimmedDraft;
    const contextSnapshot = [...contextItems];
    const userMessage: AiPlannerMessage = {
      id: globalThis.crypto.randomUUID(),
      role: "user",
      metadata: { createdAt: Date.now(), source: client.source },
      parts: [
        { type: "text", text: prompt },
        { type: "data-planner-context", data: { items: contextSnapshot } },
      ],
    };
    const nextMessages = [...messages, userMessage];
    const assistantMessageId = globalThis.crypto.randomUUID();
    const abortController = new AbortController();

    setMessages(nextMessages);
    setDraft("");
    setIsGenerating(true);
    responseAbortRef.current = abortController;

    function updateAssistantMessage(content: string, proposal?: AiPlannerProposal) {
      setMessages((current) => {
        const currentAssistant = current.find((message) => message.id === assistantMessageId);
        const currentProposalPart = currentAssistant?.parts.find(
          (part) => part.type === "tool-proposePlannerOperations",
        );
        const nextContent = content || (currentAssistant ? getMessageText(currentAssistant) : "");
        const nextAssistant: AiPlannerMessage = {
          id: assistantMessageId,
          role: "assistant",
          metadata: { createdAt: Date.now(), source: client.source },
          parts: [
            {
              type: "text",
              text: nextContent || "변경안을 검토해 주세요.",
            },
            ...(proposal
              ? [
                  {
                    type: "tool-proposePlannerOperations" as const,
                    toolCallId: proposal.id,
                    state: "approval-requested" as const,
                    input: proposal,
                    approval: { id: `approval-${proposal.id}` },
                  },
                ]
              : currentProposalPart
                ? [currentProposalPart]
                : []),
          ],
        };

        return currentAssistant
          ? current.map((message) => (message.id === assistantMessageId ? nextAssistant : message))
          : [...current, nextAssistant];
      });
    }

    void (async () => {
      let responseText = "";

      try {
        for await (const event of client.stream(
          {
            contextItems: contextSnapshot,
            messages: nextMessages.flatMap((message) =>
              message.id === welcomeMessage.id || message.role === "system"
                ? []
                : [{ content: getMessageText(message), role: message.role }],
            ),
          },
          { signal: abortController.signal },
        )) {
          if (event.type === "text-delta") {
            responseText += event.text;
            updateAssistantMessage(responseText);
          } else if (event.type === "proposal") {
            updateAssistantMessage(responseText, event.proposal);
          } else if (event.type === "error") {
            updateAssistantMessage(event.message);
          }
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          updateAssistantMessage(
            error instanceof Error ? error.message : "AI 플래너 응답을 불러오지 못했습니다.",
          );
        }
      } finally {
        if (responseAbortRef.current === abortController) {
          responseAbortRef.current = null;
          setIsGenerating(false);
          queueMicrotask(() => latestMessageRef.current?.scrollIntoView({ block: "end" }));
        }
      }
    })();
  }

  return (
    <section aria-label="AI 플래너 채팅" className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b pb-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles aria-hidden="true" className="size-4 text-brand" />
            AI 플래너
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {client.source === "api" ? "AI Gateway 스트리밍" : "Mock 제안 UI"}
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={resetConversation}>
          <Plus aria-hidden="true" className="size-4" />새 대화
        </Button>
      </div>

      <div aria-label="AI가 참고할 일정" className="flex min-h-9 flex-wrap gap-1.5 border-b py-2">
        {contextItems.length > 0 ? (
          contextItems.map((item) => (
            <span
              key={item.pathId}
              className="max-w-full truncate rounded-full bg-brand/10 px-2.5 py-1 text-[11px] font-medium text-brand"
            >
              {item.name}
            </span>
          ))
        ) : (
          <span className="text-[11px] text-muted-foreground">선택한 일정 없이 질문하기</span>
        )}
      </div>

      <div
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        className="scrollbar-hide min-h-0 flex-1 space-y-3 overflow-y-auto py-4"
      >
        {messages.map((message) => (
          <article
            key={message.id}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[94%] rounded-2xl px-3 py-2 text-sm leading-5 [overflow-wrap:anywhere] ${
                message.role === "user"
                  ? "rounded-br-md bg-brand text-brand-foreground"
                  : "rounded-bl-md bg-muted text-foreground"
              }`}
            >
              {message.role === "assistant" ? (
                <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-brand">
                  <Bot aria-hidden="true" className="size-3.5" />
                  AI 플래너
                </p>
              ) : null}
              {message.parts.map((part) => {
                if (part.type === "text") {
                  return <p key={`${message.id}-text`}>{part.text}</p>;
                }

                if (part.type === "data-planner-context") {
                  if (part.data.items.length === 0) return null;

                  return (
                    <aside
                      key={`${message.id}-planner-context`}
                      aria-label="이 메시지의 참고 일정"
                      className="mt-2 border-t border-brand-foreground/25 pt-2"
                    >
                      <p className="text-[10px] font-medium opacity-75">참고 일정 snapshot</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {part.data.items.map((item) => (
                          <span
                            key={item.pathId}
                            className="max-w-full truncate rounded-full bg-background/20 px-2 py-0.5 text-[10px]"
                          >
                            {item.name}
                          </span>
                        ))}
                      </div>
                    </aside>
                  );
                }

                if (
                  part.type === "tool-proposePlannerOperations" &&
                  part.state !== "input-streaming" &&
                  part.input
                ) {
                  return (
                    <AiPlannerProposalCard
                      key={part.toolCallId}
                      onReject={() => rejectProposal(part.toolCallId)}
                      proposal={part.input}
                      toolState={part.state}
                    />
                  );
                }

                return null;
              })}
            </div>
          </article>
        ))}
        {isGenerating ? (
          <div role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin text-brand" />
            선택한 일정 문맥을 분석하는 중입니다
          </div>
        ) : null}
        <div ref={latestMessageRef} aria-hidden="true" />
      </div>

      <form className="border-t pt-3" onSubmit={handleSubmit}>
        <label htmlFor="ai-planner-message" className="sr-only">
          AI 플래너에게 메시지
        </label>
        <div className="flex items-end gap-2">
          <textarea
            id="ai-planner-message"
            rows={2}
            value={draft}
            disabled={isGenerating}
            placeholder="일정을 분석하거나 변경해 달라고 요청하세요"
            className="min-h-16 flex-1 resize-none rounded-xl border bg-background px-3 py-2 text-sm outline-none focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/15 disabled:cursor-not-allowed disabled:opacity-60"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          {isGenerating ? (
            <Button type="button" size="icon-lg" aria-label="AI 응답 중단" onClick={stopGenerating}>
              <Square aria-hidden="true" className="size-3.5 fill-current" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon-lg"
              aria-label="AI 플래너에게 보내기"
              disabled={!trimmedDraft}
              className="bg-brand text-brand-foreground hover:bg-brand-hover"
            >
              <Send aria-hidden="true" className="size-4" />
            </Button>
          )}
        </div>
      </form>
    </section>
  );
}
