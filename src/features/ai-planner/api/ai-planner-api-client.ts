import type {
  AiPlannerChatClient,
  AiPlannerChatEvent,
  AiPlannerOperationPreview,
  AiPlannerProposal,
} from "@/features/ai-planner/types/ai-planner";

const operationTypes = new Set(["move-activity", "update-activity-memo", "update-activity-time"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isOperation(value: unknown): value is AiPlannerOperationPreview {
  return (
    isRecord(value) &&
    typeof value.after === "string" &&
    typeof value.before === "string" &&
    typeof value.id === "string" &&
    typeof value.label === "string" &&
    typeof value.pathId === "string" &&
    typeof value.reason === "string" &&
    typeof value.type === "string" &&
    operationTypes.has(value.type)
  );
}

function isProposal(value: unknown): value is AiPlannerProposal {
  return (
    isRecord(value) &&
    isStringArray(value.assumptions) &&
    typeof value.id === "string" &&
    Array.isArray(value.operations) &&
    value.operations.every(isOperation) &&
    (value.status === "draft" || value.status === "rejected") &&
    typeof value.summary === "string" &&
    isStringArray(value.warnings)
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
  if (value.type === "proposal" && isProposal(value.proposal)) {
    return { type: "proposal", proposal: value.proposal };
  }
  throw new TypeError("Invalid AI planner stream event.");
}

type CreateAiPlannerApiClientOptions = {
  readonly accessToken: string;
  readonly apiBaseUrl?: string;
  readonly fetchImplementation?: typeof fetch;
  readonly projectId: string;
};

function createEndpoint(apiBaseUrl: string | undefined, projectId: string): string {
  const path = `/api/v2/projects/${encodeURIComponent(projectId)}/ai/chat`;
  return apiBaseUrl ? `${apiBaseUrl.replace(/\/+$/, "")}${path}` : path;
}

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

export function createAiPlannerApiClient({
  accessToken,
  apiBaseUrl,
  fetchImplementation = fetch,
  projectId,
}: CreateAiPlannerApiClientOptions): AiPlannerChatClient {
  return {
    source: "api",
    async *stream(input, { signal }) {
      const response = await fetchImplementation(createEndpoint(apiBaseUrl, projectId), {
        method: "POST",
        headers: {
          Accept: "application/x-ndjson",
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: input.messages,
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
