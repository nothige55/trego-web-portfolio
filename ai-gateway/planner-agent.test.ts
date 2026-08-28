import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { MockLanguageModelV4, simulateReadableStream } from "ai/test";
import { describe, expect, it } from "vitest";

import type { AiPlannerChatRequest } from "./contracts.js";
import { streamPlannerResponse } from "./planner-agent.js";

const request: AiPlannerChatRequest = {
  projectId: "project-1",
  messages: [{ role: "user", content: "오후로 옮겨줘" }],
  selectedPathIds: ["activity-1"],
  contextItems: [
    {
      kind: "day",
      name: "도쿄 2일차",
      pathId: "day-2",
      parentPathId: null,
      position: 1,
    },
    {
      kind: "activity",
      name: "아사쿠사 산책",
      pathId: "activity-1",
      parentPathId: "day-2",
      position: 0,
      startTime: "10:00",
      endTime: "11:30",
    },
  ],
};

const usage = {
  inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 30, text: 20, reasoning: 10 },
};

function createModel(proposalPathId: string) {
  const chunks: LanguageModelV4StreamPart[] = [
    { type: "stream-start", warnings: [] },
    { type: "text-start", id: "text-1" },
    { type: "text-delta", id: "text-1", delta: "변경안을 준비했습니다." },
    { type: "text-end", id: "text-1" },
    {
      type: "tool-call",
      toolCallId: "tool-1",
      toolName: "proposePlannerOperations",
      input: JSON.stringify({
        summary: "아사쿠사 일정을 오후로 조정합니다.",
        assumptions: ["오후는 14시로 해석했습니다."],
        warnings: [],
        operations: [
          {
            type: "update-activity-time",
            pathId: proposalPathId,
            startTime: "14:00",
            endTime: "15:30",
            reason: "사용자의 시간 변경 요청을 반영합니다.",
          },
        ],
      }),
    },
    {
      type: "finish",
      finishReason: { unified: "tool-calls", raw: "tool_calls" },
      usage,
    },
  ];

  return new MockLanguageModelV4({
    doStream: {
      stream: simulateReadableStream({ chunks }),
    },
  });
}

async function collectEvents(model: MockLanguageModelV4) {
  const events = [];
  for await (const event of streamPlannerResponse({ input: request, model })) {
    events.push(event);
  }
  return events;
}

describe("streamPlannerResponse", () => {
  it("streams text and a validated proposal without executing the operation", async () => {
    const events = await collectEvents(createModel("activity-1"));

    expect(events).toContainEqual({ type: "text-delta", text: "변경안을 준비했습니다." });
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "proposal",
        proposal: expect.objectContaining({ summary: "아사쿠사 일정을 오후로 조정합니다." }),
      }),
    );
    expect(events).toContainEqual({
      type: "finish",
      finishReason: "tool-calls",
      usage: { inputTokens: 100, outputTokens: 30, totalTokens: 130 },
    });
  });

  it("rejects a proposal that targets an Activity outside the supplied context", async () => {
    const events = await collectEvents(createModel("unknown-activity"));

    expect(events).toContainEqual({
      type: "proposal-rejected",
      reason: "현재 문맥에 없는 Activity가 변경안에 포함되었습니다.",
    });
    expect(events.some((event) => event.type === "proposal")).toBe(false);
  });
});
