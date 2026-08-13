export type AiPlannerContextKind = "activity" | "day" | "folder";

export interface AiPlannerContextItem {
  readonly kind: AiPlannerContextKind;
  readonly name: string;
  readonly pathId: string;
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

export interface AiPlannerMessage {
  readonly content: string;
  readonly id: string;
  readonly proposal?: AiPlannerProposal;
  readonly role: "assistant" | "user";
}

export interface AiPlannerChatInput {
  readonly contextItems: readonly AiPlannerContextItem[];
  readonly messages: readonly Pick<AiPlannerMessage, "content" | "role">[];
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
