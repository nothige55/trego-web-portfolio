// 일정 트리의 행 하나를 그림
// 선택·hover·드롭 상태 표현과 행 안에서 시작하는 편집만 담당하고, 편집 상태 자체는 패널이 소유

import { useSortable } from "@dnd-kit/sortable";
import { ChevronDown, ChevronRight } from "lucide-react";
import { type ReactNode, useCallback } from "react";

import { DayMapVisibilityToggle } from "@/features/planner/components/day-map-visibility-toggle";
import { PlannerActivityMemo } from "@/features/planner/components/planner-activity-memo";
import { PlannerNodeLabel } from "@/features/planner/components/planner-node-label";
import { PLANNER_ROUTE_INFO_HEIGHT } from "@/features/planner/components/planner-route-info";
import { PlannerTreeItemContextMenu } from "@/features/planner/components/planner-tree-item-context-menu";
import { PlannerTreeItemNameInput } from "@/features/planner/components/planner-tree-item-name-input";
import type { PlannerMemoEditing } from "@/features/planner/hooks/use-planner-memo-editing";
import type { PlannerNameEditing } from "@/features/planner/hooks/use-planner-name-editing";
import { usePlannerViewStore } from "@/features/planner/stores/planner-view-store";
import type { PlannerNodeEditingCommands } from "@/features/planner/types/planner-editing-commands";
import type {
  FlattenedPlannerNode,
  PlannerNodePathId,
} from "@/features/planner/types/planner-node";
import {
  getPlannerRowHighlight,
  getPlannerRowHighlightClassName,
  getPlannerSelectionState,
  PLANNER_ROW_SURFACE_CLASS_NAME,
} from "@/features/planner/utils/get-planner-row-highlight";
import { getPlannerRowIndentation } from "@/features/planner/utils/get-planner-row-indentation";

export function PlannerTreeItem({
  node,
  dayNumber,
  registerItem,
  routeInfo,
  dragRouteInfo,
  dragOffset,
  boundaryAncestor,
  isDropTargetVisible,
  isChildTarget,
  isExpandingTarget,
  isSortable,
  suppressSelectionHighlight,
  commands,
  nameEditing,
  memoEditing,
}: {
  readonly node: FlattenedPlannerNode;
  readonly dayNumber?: number;
  // 렌더마다 새 함수가 오면 ref가 떨어졌다 붙어 dnd-kit이 droppable을 다시 잼
  // pathId와 함께 부르는 고정 함수를 받아 이 안에서 안정된 콜백으로 묶음
  readonly registerItem: (pathId: PlannerNodePathId, element: HTMLDivElement | null) => void;
  // 평상시 행 머리에 붙는 경로 정보 칸. 노드의 히트박스에는 들어가지 않음
  // 드래그 중에는 레이아웃 높이만 지키는 빈 칸으로 남고, 내용은 dragRouteInfo가 그림
  readonly routeInfo?: ReactNode;
  // 드래그 중 경로 정보. 노드 박스 바로 위에 겹쳐 그려 노드와 함께 옮겨 가고,
  // 레이아웃 높이에는 영향을 주지 않음
  readonly dragRouteInfo?: ReactNode;
  // 드래그 중 노드 박스를 옮길 거리. 지금 놓았을 때의 배치에서 계산
  readonly dragOffset: number;
  readonly boundaryAncestor?: FlattenedPlannerNode;
  // 놓을 자리가 있을 때만 빈 자리를 표시. 목록 밖에서는 빠진 것처럼 보여야 함
  readonly isDropTargetVisible: boolean;
  readonly isChildTarget: boolean;
  readonly isExpandingTarget: boolean;
  readonly isSortable: boolean;
  readonly suppressSelectionHighlight: boolean;
  readonly commands?: PlannerNodeEditingCommands;
  readonly nameEditing: PlannerNameEditing;
  readonly memoEditing: PlannerMemoEditing;
}) {
  const entityMap = usePlannerViewStore((state) => state.tree.entityMap);
  const childrenMap = usePlannerViewStore((state) => state.tree.childrenMap);
  const expandedIds = usePlannerViewStore((state) => state.expandedIds);
  const selectedItemId = usePlannerViewStore((state) => state.selectedItemId);
  const hoveredItemId = usePlannerViewStore((state) => state.hoveredItemId);
  const multiSelectedIds = usePlannerViewStore((state) => state.multiSelectedIds);
  const selectionRangeIds = usePlannerViewStore((state) => state.selectionRangeIds);
  const toggleExpanded = usePlannerViewStore((state) => state.toggleExpanded);
  const activateItem = usePlannerViewStore((state) => state.activateItem);
  const selectItem = usePlannerViewStore((state) => state.selectItem);
  const setHoveredItem = usePlannerViewStore((state) => state.setHoveredItem);
  // 밀림은 dnd-kit의 정렬 전략이 아니라 패널이 계산한 dragOffset으로 그림
  // 경로 정보 칸이 드래그 도중 생기거나 사라지는 걸 전략은 모르기 때문
  const { attributes, isDragging, listeners, setNodeRef } = useSortable({
    id: node.pathId,
    disabled: !isSortable,
  });
  const hasChildren = (childrenMap.get(node.pathId) ?? []).length > 0;
  const isExpanded = expandedIds.has(node.pathId);
  const selectionState = getPlannerSelectionState(
    node,
    { selectedItemId, multiSelectedIds, selectionRangeIds },
    entityMap,
  );
  const isSelected = selectionState === "selected";
  const isMapHovered = hoveredItemId === node.pathId;
  // 선택 상태는 유지하되 drag overlay와 중복 강조되지 않도록 목록 배경만 숨김
  // 라벨과 메모가 같은 값을 써서 한 노드가 한 톤으로 보이게 함
  const highlight = getPlannerRowHighlight({
    selectionState,
    isMapHovered,
    isSelectionHighlightSuppressed: suppressSelectionHighlight,
  });
  const labelHoverClassName =
    highlight === "range" ? "hover:bg-brand/10" : highlight ? "" : "hover:bg-muted/70";
  // 별도의 20px 토글 칸을 항상 유지해 자식 유무와 관계없이 라벨 시작점을 맞춤
  const indentation = getPlannerRowIndentation(node.depth);
  const isEditingName = nameEditing.editingPathId === node.pathId;
  const canRename = node.kind === "folder" || node.kind === "day";
  const operationPathIds = multiSelectedIds.includes(node.pathId)
    ? multiSelectedIds
    : [node.pathId];
  // 렌더마다 새 ref 함수가 가면 노드가 떨어졌다 붙어 dnd-kit이 droppable을 다시 잼
  const setRefs = useCallback(
    (element: HTMLDivElement | null) => {
      setNodeRef(element);
      registerItem(node.pathId, element);
    },
    [node.pathId, registerItem, setNodeRef],
  );
  return (
    <li
      {...attributes}
      role="treeitem"
      aria-expanded={hasChildren ? isExpanded : undefined}
      aria-selected={isSelected}
      data-selection-state={selectionState ?? undefined}
      data-map-highlight={isMapHovered ? "hovered" : undefined}
      data-drop-state={isChildTarget ? "child" : isExpandingTarget ? "expanding" : undefined}
      className="list-none"
    >
      {routeInfo}
      {/* 잡는 단위이자 충돌 rect. 경로 정보를 뺀 라벨 + 메모만 여기에 들어감 */}
      <div
        ref={setRefs}
        {...listeners}
        data-planner-node=""
        className={`relative touch-none ${
          isSortable ? "cursor-grab active:cursor-grabbing" : "cursor-default"
        }`}
        // 지도와 공유하는 hover는 라벨이 아니라 노드 박스 전체에서 받음
        // 라벨에서만 받으면 같은 톤으로 칠해진 메모로 내려가는 순간 강조가 풀림
        onPointerEnter={() => setHoveredItem(node.pathId)}
        onPointerLeave={() => {
          if (usePlannerViewStore.getState().hoveredItemId === node.pathId) {
            setHoveredItem(null);
          }
        }}
        style={{
          // transform은 dnd-kit이 재는 이 요소에 직접 걸어 둠. 부모(li)에 걸면 다시 잴 때
          // 그 이동량이 rect에 섞임(ignoreTransform은 잰 요소 자신의 것만 되돌림)
          transform: dragOffset ? `translate3d(0, ${dragOffset}px, 0)` : undefined,
          // 잡고 있는 동안에는 원래 자리를 비우되 높이는 유지
          // visibility는 상속되므로 아래 placeholder만 다시 켜서 빈 자리를 표시
          visibility: isDragging ? "hidden" : undefined,
        }}
      >
        {dragRouteInfo ? (
          <div
            className="pointer-events-none visible absolute inset-x-0 bottom-full"
            style={{ height: PLANNER_ROUTE_INFO_HEIGHT }}
          >
            {dragRouteInfo}
          </div>
        ) : null}
        {isDragging && isDropTargetVisible ? (
          <div
            aria-hidden="true"
            data-testid="planner-drag-placeholder"
            className="visible absolute inset-0 rounded-md border border-dashed border-brand/40 bg-brand/5"
          />
        ) : null}
        {boundaryAncestor ? (
          <div
            aria-hidden="true"
            data-testid="planner-root-boundary-label"
            className="pointer-events-none absolute inset-x-0 top-0 z-30 flex h-8 items-center bg-card pr-2 pl-[22px]"
          >
            <PlannerNodeLabel
              node={boundaryAncestor}
              parent={
                boundaryAncestor.parentPathId
                  ? entityMap.get(boundaryAncestor.parentPathId)
                  : undefined
              }
              className="w-full"
            />
          </div>
        ) : null}
        <PlannerTreeItemContextMenu
          node={node}
          commands={commands}
          operationPathIds={operationPathIds}
          onBeginEditing={nameEditing.begin}
          trigger={
            <div
              className={`group flex h-9 items-center text-foreground ${PLANNER_ROW_SURFACE_CLASS_NAME} ${
                isChildTarget
                  ? "planner-child-drop-fill border-brand"
                  : isExpandingTarget
                    ? "border-brand/60 bg-brand/5"
                    : `${getPlannerRowHighlightClassName(highlight)} ${labelHoverClassName}`
              }`}
              style={{ paddingLeft: indentation }}
            />
          }
        >
          <span className="flex h-9 w-5 shrink-0 items-center justify-center">
            {hasChildren ? (
              <button
                type="button"
                aria-label={`${node.name} ${isExpanded ? "접기" : "펼치기"}`}
                className="flex h-9 w-5 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleExpanded(node.pathId);
                }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
              >
                {isExpanded ? (
                  <ChevronDown aria-hidden="true" className="size-4" />
                ) : (
                  <ChevronRight aria-hidden="true" className="size-4" />
                )}
              </button>
            ) : null}
          </span>
          <PlannerNodeLabel
            node={node}
            dayNumber={dayNumber}
            parent={node.parentPathId ? entityMap.get(node.parentPathId) : undefined}
            className="flex-1 py-2.5 pr-2"
            nameContent={
              isEditingName ? (
                <PlannerTreeItemNameInput
                  node={node}
                  value={nameEditing.draft}
                  onChange={nameEditing.change}
                  onCancel={nameEditing.cancel}
                  onCommit={nameEditing.commit}
                />
              ) : undefined
            }
            onClick={
              isEditingName
                ? undefined
                : (event) => {
                    if (event.shiftKey) {
                      // 범위 선택은 선택 상태만 바꾸고 지도 카메라는 이동하지 않음
                      selectItem(node.pathId, true);
                      return;
                    }

                    activateItem(node.pathId);
                  }
            }
            onDoubleClick={
              commands && canRename
                ? (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    nameEditing.begin(node);
                  }
                : undefined
            }
            trailing={
              node.kind === "activity" && node.startTime ? (
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                  {node.startTime}
                </span>
              ) : null
            }
          />
          {node.kind === "day" ? (
            <DayMapVisibilityToggle dayPathId={node.pathId} dayName={node.name} />
          ) : null}
        </PlannerTreeItemContextMenu>
        {node.kind === "activity" ? (
          <PlannerActivityMemo
            activity={node}
            indentation={indentation}
            editing={memoEditing}
            commands={commands}
            className={getPlannerRowHighlightClassName(highlight)}
          />
        ) : null}
      </div>
    </li>
  );
}
