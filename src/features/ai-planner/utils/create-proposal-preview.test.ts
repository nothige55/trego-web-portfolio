import { describe, expect, it } from "vitest";

import type { AiPlannerContextItem } from "@/features/ai-planner/types/ai-planner";
import { createProposalPreview } from "@/features/ai-planner/utils/create-proposal-preview";

const contextItems: readonly AiPlannerContextItem[] = [
  { kind: "day", name: "제주 1일차", pathId: "day-1", parentPathId: null, position: 0 },
  { kind: "day", name: "제주 2일차", pathId: "day-2", parentPathId: null, position: 1 },
  {
    kind: "activity",
    name: "성산일출봉",
    pathId: "activity-1",
    parentPathId: "day-1",
    position: 0,
    memo: "일출 보기",
    startTime: "07:00",
    endTime: "08:30",
  },
];

describe("createProposalPreview", () => {
  it("builds before/after text from the current context instead of the model output", () => {
    const preview = createProposalPreview(
      {
        summary: "시간을 조정합니다.",
        assumptions: [],
        warnings: [],
        operations: [
          {
            type: "update-activity-time",
            pathId: "activity-1",
            startTime: "14:00",
            endTime: "15:30",
            reason: "오후 요청",
          },
        ],
      },
      contextItems,
      "proposal-1",
    );

    expect(preview.operations).toEqual([
      {
        id: "proposal-1-0",
        label: "성산일출봉 시간",
        before: "07:00–08:30",
        after: "14:00–15:30",
        reason: "오후 요청",
        operation: expect.objectContaining({ type: "update-activity-time" }),
      },
    ]);
  });

  it("names both sides of a move with the parent Day", () => {
    const preview = createProposalPreview(
      {
        summary: "다음 날로 옮깁니다.",
        assumptions: [],
        warnings: [],
        operations: [
          {
            type: "move-activity",
            pathId: "activity-1",
            destinationParentPathId: "day-2",
            position: 1.5,
            reason: "동선 정리",
          },
        ],
      },
      contextItems,
      "proposal-2",
    );

    expect(preview.operations[0]).toMatchObject({
      label: "성산일출봉 이동",
      before: "제주 1일차",
      after: "제주 2일차",
    });
  });

  it("falls back to readable text when the context has no memo or time", () => {
    const preview = createProposalPreview(
      {
        summary: "메모를 추가합니다.",
        assumptions: [],
        warnings: [],
        operations: [
          { type: "update-activity-memo", pathId: "activity-2", memo: "예약 필요", reason: "확인" },
        ],
      },
      [{ kind: "activity", name: "카페", pathId: "activity-2" }],
      "proposal-3",
    );

    expect(preview.operations[0]).toMatchObject({
      label: "카페 메모",
      before: "메모 없음",
      after: "예약 필요",
    });
  });
});
