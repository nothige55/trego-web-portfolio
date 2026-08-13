import { z } from "zod";

const pathIdSchema = z.string().trim().min(1).max(200);

export const aiPlannerContextItemSchema = z.object({
  kind: z.enum(["folder", "day", "activity"]),
  name: z.string().trim().min(1).max(200),
  pathId: pathIdSchema,
  parentPathId: pathIdSchema.nullable(),
  position: z.number().int().nonnegative(),
  memo: z.string().max(4_000).nullable().optional(),
  startTime: z.string().max(50).nullable().optional(),
  endTime: z.string().max(50).nullable().optional(),
});

export const aiPlannerChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(8_000),
});

export const aiPlannerChatRequestSchema = z
  .object({
    projectId: z.string().trim().min(1).max(100),
    memberId: z.string().trim().min(1).max(100),
    messages: z.array(aiPlannerChatMessageSchema).min(1).max(30),
    contextItems: z.array(aiPlannerContextItemSchema).max(100),
    selectedPathIds: z.array(pathIdSchema).max(100),
  })
  .superRefine((request, context) => {
    const knownPathIds = new Set(request.contextItems.map((item) => item.pathId));
    request.selectedPathIds.forEach((pathId, index) => {
      if (!knownPathIds.has(pathId)) {
        context.addIssue({
          code: "custom",
          message: "Selected path ID must exist in contextItems.",
          path: ["selectedPathIds", index],
        });
      }
    });
  });

const operationReasonSchema = z.string().trim().min(1).max(500);

export const plannerOperationProposalSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("move-activity"),
    pathId: pathIdSchema,
    destinationParentPathId: pathIdSchema,
    position: z.number().int().nonnegative(),
    reason: operationReasonSchema,
  }),
  z.object({
    type: z.literal("update-activity-memo"),
    pathId: pathIdSchema,
    memo: z.string().max(4_000).nullable(),
    reason: operationReasonSchema,
  }),
  z
    .object({
      type: z.literal("update-activity-time"),
      pathId: pathIdSchema,
      startTime: z.string().max(50).nullable(),
      endTime: z.string().max(50).nullable(),
      reason: operationReasonSchema,
    })
    .refine((operation) => operation.startTime !== null || operation.endTime !== null, {
      message: "At least one time value must be provided.",
    }),
]);

export const plannerProposalSchema = z.object({
  summary: z.string().trim().min(1).max(1_000),
  assumptions: z.array(z.string().trim().min(1).max(500)).max(10),
  warnings: z.array(z.string().trim().min(1).max(500)).max(10),
  operations: z.array(plannerOperationProposalSchema).min(1).max(20),
});

export type AiPlannerChatRequest = z.infer<typeof aiPlannerChatRequestSchema>;
export type PlannerProposal = z.infer<typeof plannerProposalSchema>;

export type AiPlannerStreamEvent =
  | { readonly type: "text-delta"; readonly text: string }
  | { readonly type: "proposal"; readonly proposal: PlannerProposal }
  | { readonly type: "proposal-rejected"; readonly reason: string }
  | {
      readonly type: "finish";
      readonly finishReason: string;
      readonly usage: {
        readonly inputTokens?: number;
        readonly outputTokens?: number;
        readonly totalTokens?: number;
      };
    }
  | { readonly type: "error"; readonly message: string };
