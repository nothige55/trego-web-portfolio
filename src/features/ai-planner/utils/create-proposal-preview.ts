import type {
  AiPlannerContextItem,
  AiPlannerOperationPreview,
  AiPlannerProposal,
  AiPlannerProposalPreview,
  AiPlannerProposedOperation,
} from "@/features/ai-planner/types/ai-planner";

function formatTimeRange(startTime?: string | null, endTime?: string | null): string {
  const range = [startTime, endTime].filter((value): value is string => Boolean(value));
  return range.length > 0 ? range.join("–") : "시간 미정";
}

function createOperationPreview(
  operation: AiPlannerProposedOperation,
  id: string,
  contextByPathId: ReadonlyMap<string, AiPlannerContextItem>,
): AiPlannerOperationPreview {
  const target = contextByPathId.get(operation.pathId);
  const targetName = target?.name ?? "선택한 일정";

  if (operation.type === "move-activity") {
    const currentParent = target?.parentPathId
      ? contextByPathId.get(target.parentPathId)?.name
      : undefined;
    const destination = contextByPathId.get(operation.destinationParentPathId)?.name;

    return {
      id,
      label: `${targetName} 이동`,
      before: currentParent ?? "현재 위치",
      after: destination ?? "새 위치",
      operation,
      reason: operation.reason,
    };
  }

  if (operation.type === "update-activity-memo") {
    return {
      id,
      label: `${targetName} 메모`,
      before: target?.memo?.trim() || "메모 없음",
      after: operation.memo?.trim() || "메모 삭제",
      operation,
      reason: operation.reason,
    };
  }

  return {
    id,
    label: `${targetName} 시간`,
    before: formatTimeRange(target?.startTime, target?.endTime),
    after: formatTimeRange(operation.startTime, operation.endTime),
    operation,
    reason: operation.reason,
  };
}

// 모델이 보낸 정식 명령을 현재 Planner 문맥 기준의 화면 문구로 옮긴다.
// before는 스냅샷이 아니라 지금 값이라서, 문맥이 바뀌면 diff도 같이 정확해진다.
export function createProposalPreview(
  proposal: AiPlannerProposal,
  contextItems: readonly AiPlannerContextItem[],
  proposalId: string,
): AiPlannerProposalPreview {
  const contextByPathId = new Map(contextItems.map((item) => [item.pathId, item]));

  return {
    id: proposalId,
    summary: proposal.summary,
    assumptions: proposal.assumptions,
    warnings: proposal.warnings,
    operations: proposal.operations.map((operation, index) =>
      createOperationPreview(operation, `${proposalId}-${index}`, contextByPathId),
    ),
  };
}
