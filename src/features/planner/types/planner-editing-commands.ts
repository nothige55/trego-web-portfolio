import type { PlannerDropDestination } from "@/features/planner/dnd/planner-drop-rules";
import type { PlannerDateRangeInput } from "@/features/planner/operations/planner-date-range";
import type { PlannerCreateNodeDraft } from "@/features/planner/operations/planner-operations";
import type { PlannerRealtimeCommands } from "@/features/planner/realtime/planner-realtime";
import type { PlannerNodePathId } from "@/features/planner/types/planner-node";

// 일정 패널이 app 레이어에서 주입받는 편집 명령 계약이다.
// 패널 컴포넌트 파일에 두면 하위 컴포넌트와 hook이 패널을 역참조하게 되므로 타입만 여기에 모은다.
export type PlannerNodeMoveHandler = (
  pathId: PlannerNodePathId,
  destination: Readonly<PlannerDropDestination>,
) => void;

export type PlannerNodeEditingCommands = Pick<
  PlannerRealtimeCommands,
  "deleteNode" | "updateActivity" | "updateDay" | "updateFolder"
> & {
  readonly createNode?: (draft: PlannerCreateNodeDraft) => Promise<void>;
  readonly deleteNodes?: (pathIds: readonly PlannerNodePathId[]) => Promise<void>;
  readonly editActivityMemo?: (pathId: PlannerNodePathId) => void;
  readonly extendDateRange?: () => Promise<void>;
  readonly groupNodes?: (pathIds: readonly PlannerNodePathId[]) => Promise<void>;
  readonly redo?: () => Promise<void>;
  readonly undo?: () => Promise<void>;
  readonly updateDateRange?: (input: PlannerDateRangeInput) => Promise<void>;
};
