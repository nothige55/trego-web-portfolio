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

// 모델이 제안하는 정식 변경 명령. Gateway 스키마와 1:1이며 화면 문구를 담지 않는다.
export type AiPlannerProposedOperation =
  | {
      readonly type: "move-activity";
      readonly pathId: string;
      readonly destinationParentPathId: string;
      readonly position: number;
      readonly reason: string;
    }
  | {
      readonly type: "update-activity-memo";
      readonly pathId: string;
      readonly memo: string | null;
      readonly reason: string;
    }
  | {
      readonly type: "update-activity-time";
      readonly pathId: string;
      readonly startTime: string | null;
      readonly endTime: string | null;
      readonly reason: string;
    };

export interface AiPlannerProposal {
  readonly assumptions: readonly string[];
  readonly operations: readonly AiPlannerProposedOperation[];
  readonly summary: string;
  readonly warnings: readonly string[];
}

// 화면이 그리는 형태. 라벨과 before/after는 클라이언트가 자기 Planner 상태에서 만든다.
export interface AiPlannerOperationPreview {
  readonly after: string;
  readonly before: string;
  readonly id: string;
  readonly label: string;
  readonly operation: AiPlannerProposedOperation;
  readonly reason: string;
}

export interface AiPlannerProposalPreview {
  readonly assumptions: readonly string[];
  readonly id: string;
  readonly operations: readonly AiPlannerOperationPreview[];
  readonly summary: string;
  readonly warnings: readonly string[];
}

// 승인된 변경을 실제 Planner 명령으로 실행하는 함수. app 레이어가 구현을 주입한다.
export type AiPlannerOperationExecutor = (
  operations: readonly AiPlannerProposedOperation[],
) => Promise<void>;

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
    readonly input: AiPlannerProposalPreview;
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
  | { readonly type: "proposal-rejected"; readonly reason: string }
  | { readonly type: "finish" }
  | { readonly type: "error"; readonly message: string };

export interface AiPlannerChatClient {
  readonly source: "api" | "mock";
  stream: (
    input: AiPlannerChatInput,
    options: { readonly signal: AbortSignal },
  ) => AsyncIterable<AiPlannerChatEvent>;
}
