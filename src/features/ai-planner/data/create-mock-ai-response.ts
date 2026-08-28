import type {
  AiPlannerContextItem,
  AiPlannerGeneratedResponse,
  AiPlannerOperationPreview,
  AiPlannerProposal,
} from "@/features/ai-planner/types/ai-planner";

function createId(): string {
  return globalThis.crypto.randomUUID();
}

function createActivityProposal(activity: AiPlannerContextItem, prompt: string): AiPlannerProposal {
  const currentMemo = activity.memo?.trim() || "메모 없음";
  const operations: AiPlannerOperationPreview[] = [
    {
      id: createId(),
      type: "update-activity-memo",
      pathId: activity.pathId,
      label: `${activity.name} 메모 보완`,
      before: currentMemo,
      after: `${prompt} 요청을 확인할 메모 추가`,
      reason: "요청의 의도를 일정에서 다시 확인할 수 있도록 남깁니다.",
    },
  ];

  if (/(시간|오전|오후|늦|일찍)/.test(prompt)) {
    const currentTime = [activity.startTime, activity.endTime].filter(Boolean).join("–");
    operations.push({
      id: createId(),
      type: "update-activity-time",
      pathId: activity.pathId,
      label: `${activity.name} 시간 조정`,
      before: currentTime || "시간 미정",
      after: "요청에 맞춘 추천 시간",
      reason: "선택한 일정의 시간대 요청을 반영합니다.",
    });
  }

  return {
    id: createId(),
    status: "draft",
    summary: `${activity.name} 일정에 ${operations.length}개의 변경을 제안합니다.`,
    assumptions: ["현재 선택한 Activity만 변경 대상으로 해석했습니다."],
    warnings: ["이 변경안은 Mock이며 아직 서버에 적용되지 않습니다."],
    operations,
  };
}

export function createMockAiResponse(
  prompt: string,
  contextItems: readonly AiPlannerContextItem[],
): AiPlannerGeneratedResponse {
  const activity = contextItems.find((item) => item.kind === "activity");
  const contextLabel = contextItems.map((item) => item.name).join(", ");

  if (!activity) {
    return {
      content: contextLabel
        ? `${contextLabel} 문맥을 확인했습니다. 구체적인 변경안을 만들려면 Activity를 선택해 주세요.`
        : "일정 선택 없이 일반 여행 질문으로 이해했습니다. Planner 항목을 선택하면 해당 문맥을 함께 분석할 수 있어요.",
    };
  }

  return {
    content: `${activity.name}을 기준으로 요청을 분석했습니다. 승인 전에 아래 변경안을 검토해 주세요.`,
    proposal: createActivityProposal(activity, prompt),
  };
}
