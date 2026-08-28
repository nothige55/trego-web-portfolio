import type { ToolUIPart, UIMessage } from "ai";

export type AiPlannerContextKind = "activity" | "day" | "folder";

export interface AiPlannerContextItem {
  readonly endTime?: string | null;
  readonly kind: AiPlannerContextKind;
  readonly memo?: string | null;
  readonly name: string;
  readonly parentPathId?: string | null;
  readonly pathId: string;
  readonly position?: number;
  readonly startTime?: string | null;
}

export type AiPlannerOperationType =
  | "move-activity"
  | "update-activity-memo"
  | "update-activity-time";

export interface AiPlannerOperationPreview {
  readonly after: string;
  readonly before: string;
  readonly id: string;
  readonly label: string;
  readonly pathId: string;
  readonly reason: string;
  readonly type: AiPlannerOperationType;
}

export interface AiPlannerProposal {
  readonly assumptions: readonly string[];
  readonly id: string;
  readonly operations: readonly AiPlannerOperationPreview[];
  readonly status: "draft" | "rejected";
  readonly summary: string;
  readonly warnings: readonly string[];
}

export interface AiPlannerGeneratedResponse {
  readonly content: string;
  readonly proposal?: AiPlannerProposal;
}

export type AiPlannerMessageMetadata = {
  readonly createdAt: number;
  readonly source: "api" | "mock" | "system";
};

export type AiPlannerDataParts = {
  readonly "planner-context": {
    readonly items: readonly AiPlannerContextItem[];
  };
};

export type AiPlannerUiTools = {
  readonly proposePlannerOperations: {
    readonly input: AiPlannerProposal;
    readonly output: {
      readonly appliedOperationIds: readonly string[];
      readonly status: "applied" | "rejected";
    };
  };
};

export type AiPlannerMessage = UIMessage<
  AiPlannerMessageMetadata,
  AiPlannerDataParts,
  AiPlannerUiTools
>;

export type AiPlannerProposalToolPart = ToolUIPart<AiPlannerUiTools>;

export interface AiPlannerHistoryMessage {
  readonly content: string;
  readonly role: "assistant" | "user";
}

export interface AiPlannerChatInput {
  readonly contextItems: readonly AiPlannerContextItem[];
  readonly messages: readonly AiPlannerHistoryMessage[];
}

export type AiPlannerChatEvent =
  | { readonly type: "text-delta"; readonly text: string }
  | { readonly type: "proposal"; readonly proposal: AiPlannerProposal }
  | { readonly type: "finish" }
  | { readonly type: "error"; readonly message: string };

export interface AiPlannerChatClient {
  readonly source: "api" | "mock";
  stream: (
    input: AiPlannerChatInput,
    options: { readonly signal: AbortSignal },
  ) => AsyncIterable<AiPlannerChatEvent>;
}
