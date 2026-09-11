// 드래그 중 목록을 "지금 놓으면" 보일 순서로 다시 세우고, 그 순서까지 노드 박스별로 옮길 거리를 계산
// 일정 패널은 dnd-kit 정렬 전략의 transform 대신 이 거리로 행을 밀어냄

import type {
  FlattenedPlannerNode,
  PlannerNodePathId,
} from "@/features/planner/types/planner-node";
import type { PlannerDragProjection } from "@/features/planner/utils/build-planner-drag-projection";

// 드래그 중 목록이 "지금 놓으면" 보일 순서
// 잡은 노드를 빼고, 투영된 목적지가 화면에 그려지는 자리면 그 앞에 끼움
// 목적지가 접힌 컨테이너 안처럼 화면에 없는 곳이면 null을 돌려줌
export function buildPlannerDragVisualOrder({
  rows,
  activePathId,
  projection,
  rootPathId,
  expandedIds,
}: {
  readonly rows: readonly FlattenedPlannerNode[];
  readonly activePathId: PlannerNodePathId;
  readonly projection: PlannerDragProjection;
  readonly rootPathId: PlannerNodePathId | null;
  readonly expandedIds: ReadonlySet<PlannerNodePathId>;
}): readonly FlattenedPlannerNode[] | null {
  const active = rows.find((row) => row.pathId === activePathId);
  const rest = rows.filter((row) => row.pathId !== activePathId);
  if (!active) {
    return rows;
  }

  const parentPathId = projection.parentPathId;
  if (parentPathId === null) {
    return rest;
  }

  const siblings = projection.childrenMap.get(parentPathId) ?? [];
  const index = siblings.findIndex((sibling) => sibling.pathId === activePathId);
  for (const next of siblings.slice(index + 1)) {
    const at = rest.findIndex((row) => row.pathId === next.pathId);
    if (at >= 0) {
      return [...rest.slice(0, at), active, ...rest.slice(at)];
    }
  }

  // 뒤따르는 형제가 화면에 없으면 부모 가지의 끝에 붙임
  let at = rest.length;
  if (parentPathId !== rootPathId) {
    const parentAt = rest.findIndex((row) => row.pathId === parentPathId);
    if (parentAt < 0 || !expandedIds.has(parentPathId)) {
      return null;
    }

    const parentDepth = rest[parentAt].depth;
    at = parentAt + 1;
    while (at < rest.length && rest[at].depth > parentDepth) {
      at += 1;
    }
  }

  return [...rest.slice(0, at), active, ...rest.slice(at)];
}

// 드래그 시작 때의 실제 배치(레이아웃)와 보일 순서에서 각 노드 박스의 위치를 누적해,
// 그 차이만큼 옮길 거리를 냄. 레이아웃 높이는 건드리지 않으므로 dnd-kit이 시작 때 잰
// rect가 끝까지 유효하고, 경로 정보 칸이 생기거나 사라지는 것도 이 거리 안에서 흡수됨
// 보일 순서에 없는 행(목록에서 빠진 잡은 노드)은 결과에 들어가지 않음
export function calculatePlannerDragOffsets({
  layoutRows,
  visualRows,
  getNodeHeight,
  hasLayoutSlot,
  hasVisualSlot,
  slotHeight,
}: {
  readonly layoutRows: readonly FlattenedPlannerNode[];
  readonly visualRows: readonly FlattenedPlannerNode[];
  readonly getNodeHeight: (pathId: PlannerNodePathId) => number;
  readonly hasLayoutSlot: (row: FlattenedPlannerNode) => boolean;
  readonly hasVisualSlot: (row: FlattenedPlannerNode) => boolean;
  readonly slotHeight: number;
}): ReadonlyMap<PlannerNodePathId, number> {
  const layoutTops = new Map<PlannerNodePathId, number>();
  let cursor = 0;
  for (const row of layoutRows) {
    cursor += hasLayoutSlot(row) ? slotHeight : 0;
    layoutTops.set(row.pathId, cursor);
    cursor += getNodeHeight(row.pathId);
  }

  const offsets = new Map<PlannerNodePathId, number>();
  cursor = 0;
  for (const row of visualRows) {
    cursor += hasVisualSlot(row) ? slotHeight : 0;
    offsets.set(row.pathId, cursor - (layoutTops.get(row.pathId) ?? cursor));
    cursor += getNodeHeight(row.pathId);
  }

  return offsets;
}
