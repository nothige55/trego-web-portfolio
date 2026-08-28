import type {
  AiPlannerChatClient,
  AiPlannerChatEvent,
  AiPlannerProposal,
  AiPlannerProposedOperation,
} from "@/features/ai-planner/types/ai-planner";

const AI_PLANNER_CHAT_PATH = "/ai/v1/planner/chat";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isProposedOperation(value: unknown): value is AiPlannerProposedOperation {
  if (!isRecord(value) || typeof value.pathId !== "string" || typeof value.reason !== "string") {
    return false;
  }

  if (value.type === "move-activity") {
    return typeof value.destinationParentPathId === "string" && typeof value.position === "number";
  }
  if (value.type === "update-activity-memo") {
    return isNullableString(value.memo);
  }
  if (value.type === "update-activity-time") {
    return isNullableString(value.startTime) && isNullableString(value.endTime);
  }

  return false;
}

function isProposal(value: unknown): value is AiPlannerProposal {
  return (
    isRecord(value) &&
    typeof value.summary === "string" &&
    isStringArray(value.assumptions) &&
    isStringArray(value.warnings) &&
    Array.isArray(value.operations) &&
    value.operations.length > 0 &&
    value.operations.every(isProposedOperation)
  );
}

function parseStreamEvent(value: unknown): AiPlannerChatEvent {
  if (!isRecord(value) || typeof value.type !== "string") {
    throw new TypeError("Invalid AI planner stream event.");
  }
  if (value.type === "finish") return { type: "finish" };
  if (value.type === "text-delta" && typeof value.text === "string") {
    return { type: "text-delta", text: value.text };
  }
  if (value.type === "error" && typeof value.message === "string") {
    return { type: "error", message: value.message };
  }
  if (value.type === "proposal-rejected" && typeof value.reason === "string") {
    return { type: "proposal-rejected", reason: value.reason };
  }
  if (value.type === "proposal" && isProposal(value.proposal)) {
    return { type: "proposal", proposal: value.proposal };
  }
  throw new TypeError("Invalid AI planner stream event.");
}

type CreateAiPlannerApiClientOptions = {
  readonly accessToken: string;
  readonly fetchImplementation?: typeof fetch;
  readonly projectId: string;
};

async function* parseNdjsonStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<AiPlannerChatEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.trim()) yield parseStreamEvent(JSON.parse(line));
      }

      if (done) break;
    }

    if (buffer.trim()) yield parseStreamEvent(JSON.parse(buffer));
  } finally {
    reader.releaseLock();
  }
}

// AI Gateway를 같은 origin의 /ai 경로로 직접 호출한다.
// Gateway는 이 토큰을 ASP.NET에 되물어 세션을 확인하므로 인증 판단은 여전히 백엔드가 소유한다.
export function createAiPlannerApiClient({
  accessToken,
  fetchImplementation = fetch,
  projectId,
}: CreateAiPlannerApiClientOptions): AiPlannerChatClient {
  return {
    source: "api",
    async *stream(input, { signal }) {
      const response = await fetchImplementation(AI_PLANNER_CHAT_PATH, {
        method: "POST",
        headers: {
          Accept: "application/x-ndjson",
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          messages: input.messages,
          contextItems: input.contextItems,
          selectedPathIds: input.contextItems.map((item) => item.pathId),
        }),
        signal,
      });

      if (!response.ok) {
        throw new Error(`AI 플래너 요청에 실패했습니다. (${response.status})`);
      }
      if (!response.body) throw new Error("AI 플래너 응답 스트림이 비어 있습니다.");

      yield* parseNdjsonStream(response.body);
    },
  };
}
