// 일정 행이 선택·지도 hover로 받는 강조를 계산
// 라벨, 메모, 경로 정보가 모두 이 답을 따라야 한 노드가 한 톤으로 보이고 강조 띠가 끊기지 않음

import type {
  FlattenedPlannerNode,
  PlannerNode,
  PlannerNodePathId,
} from "@/features/planner/types/planner-node";

// selected: 실제 작업 대상. range: Shift 범위 안이거나 선택된 조상에 딸려 함께 옮겨지는 행
export type PlannerSelectionState = "selected" | "range";
export type PlannerRowHighlight = PlannerSelectionState | "hovered";

type PlannerSelection = {
  readonly selectedItemId: PlannerNodePathId | null;
  readonly multiSelectedIds: readonly PlannerNodePathId[];
  readonly selectionRangeIds: readonly PlannerNodePathId[];
};

// 경로 정보의 앞 장소처럼 트리 밖에서 온 노드도 받도록 위치 정보만 요구
type PlannerNodeLocation = Pick<PlannerNode, "pathId" | "parentPathId">;

function hasSelectedAncestor(
  node: PlannerNodeLocation,
  selectedIds: readonly PlannerNodePathId[],
  entityMap: ReadonlyMap<PlannerNodePathId, FlattenedPlannerNode>,
): boolean {
  let parentPathId = node.parentPathId;

  while (parentPathId) {
    if (selectedIds.includes(parentPathId)) {
      return true;
    }

    parentPathId = entityMap.get(parentPathId)?.parentPathId ?? null;
  }

  return false;
}

export function getPlannerSelectionState(
  node: PlannerNodeLocation,
  { selectedItemId, multiSelectedIds, selectionRangeIds }: PlannerSelection,
  entityMap: ReadonlyMap<PlannerNodePathId, FlattenedPlannerNode>,
): PlannerSelectionState | null {
  // Shift 선택 중에는 정규화된 작업 대상만 강하게 표시. anchor는 범위 계산 기준으로만 남김
  const isSelected =
    multiSelectedIds.length > 0
      ? multiSelectedIds.includes(node.pathId)
      : selectedItemId === node.pathId;
  if (isSelected) {
    return "selected";
  }

  // 선택 이후 펼쳐진 자손도 실제 작업 대상에 포함된다는 의미를 연한 톤으로 이어서 보여 줌
  return selectionRangeIds.includes(node.pathId) ||
    hasSelectedAncestor(node, multiSelectedIds, entityMap)
    ? "range"
    : null;
}

// 드래그 중에는 drag overlay와 겹쳐 보이지 않도록 선택 강조만 끔. 지도 hover는 그대로 둠
export function getPlannerRowHighlight({
  selectionState,
  isMapHovered,
  isSelectionHighlightSuppressed,
}: {
  readonly selectionState: PlannerSelectionState | null;
  readonly isMapHovered: boolean;
  readonly isSelectionHighlightSuppressed: boolean;
}): PlannerRowHighlight | null {
  const visibleSelectionState = isSelectionHighlightSuppressed ? null : selectionState;

  if (visibleSelectionState === "selected") return "selected";
  if (isMapHovered) return "hovered";
  return visibleSelectionState;
}

// 경로 정보는 한 노드가 아니라 두 장소 사이 구간. 양쪽이 모두 선택 강조를 받을 때만 칠하고
// 둘 중 연한 톤을 따름. 한쪽만 칠하면 선택 영역이 옆 구간까지 번져 보임
// 지도 hover는 한 장소만 가리키므로 구간으로 잇지 않음
export function getPlannerRouteHighlight(
  previous: PlannerSelectionState | null,
  current: PlannerSelectionState | null,
): PlannerSelectionState | null {
  if (!previous || !current) {
    return null;
  }

  return previous === "selected" && current === "selected" ? "selected" : "range";
}

// 라벨·메모·경로 정보가 함께 까는 바탕. 전환 속도까지 같아야 강조가 한 번에 들어옴
// 한쪽만 transition이 있으면 나머지가 먼저 칠해지고 그쪽이 뒤늦게 따라와 따로 노는 것처럼 보임
export const PLANNER_ROW_SURFACE_CLASS_NAME = "border-l-2 transition-colors";

// 바탕 위에 얹는 왼쪽 선 색과 배경
const HIGHLIGHT_CLASS_NAMES: Record<PlannerRowHighlight, string> = {
  selected: "border-brand bg-brand/10",
  hovered: "border-brand/70 bg-brand/10",
  range: "border-transparent bg-brand/5",
};

export function getPlannerRowHighlightClassName(highlight: PlannerRowHighlight | null): string {
  return highlight ? HIGHLIGHT_CLASS_NAMES[highlight] : "border-transparent";
}
