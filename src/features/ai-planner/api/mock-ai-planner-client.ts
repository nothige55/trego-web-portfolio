import { createMockAiResponse } from "@/features/ai-planner/data/create-mock-ai-response";
import type { AiPlannerChatClient } from "@/features/ai-planner/types/ai-planner";

const MOCK_RESPONSE_DELAY_MS = 350;

function waitForMockResponse(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timerId = window.setTimeout(resolve, MOCK_RESPONSE_DELAY_MS);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timerId);
        reject(new DOMException("The AI response was stopped.", "AbortError"));
      },
      { once: true },
    );
  });
}

export const mockAiPlannerClient: AiPlannerChatClient = {
  source: "mock",
  async *stream(input, { signal }) {
    await waitForMockResponse(signal);
    const prompt = input.messages.at(-1)?.content ?? "";
    const response = createMockAiResponse(prompt, input.contextItems);

    yield { type: "text-delta", text: response.content };
    if (response.proposal) yield { type: "proposal", proposal: response.proposal };
    yield { type: "finish" };
  },
};
