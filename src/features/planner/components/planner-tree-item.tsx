import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronRight } from "lucide-react";

import { DayMapVisibilityToggle } from "@/features/planner/components/day-map-visibility-toggle";
import { PlannerActivityMemo } from "@/features/planner/components/planner-activity-memo";
import { PlannerNodeLabel } from "@/features/planner/components/planner-node-label";
import { PlannerRouteInfo } from "@/features/planner/components/planner-route-info";
import { PlannerTreeItemContextMenu } from "@/features/planner/components/planner-tree-item-context-menu";
import { PlannerTreeItemNameInput } from "@/features/planner/components/planner-tree-item-name-input";
import type { PlannerMemoEditing } from "@/features/planner/hooks/use-planner-memo-editing";
import type { PlannerNameEditing } from "@/features/planner/hooks/use-planner-name-editing";
import { usePlannerViewStore } from "@/features/planner/stores/planner-view-store";
import type { PlannerNodeEditingCommands } from "@/features/planner/types/planner-editing-commands";
import type {
  FlattenedPlannerNode,
  PlannerActivityNode,
  PlannerNodePathId,
} from "@/features/planner/types/planner-node";

function hasSelectedAncestor(
  node: FlattenedPlannerNode,
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

// 일정 트리의 행 하나를 그린다.
// 선택·hover·드롭 상태 표현과 행 안에서 시작하는 편집만 담당하고, 편집 상태 자체는 패널이 소유한다.
export function PlannerTreeItem({
  node,
  dayNumber,
  itemRef,
  boundaryAncestor,
  previousActivity,
  isChildTarget,
  isExpandingTarget,
  isSiblingDropActive,
  isSortable,
  suppressSelectionHighlight,
  commands,
  nameEditing,
  memoEditing,
}: {
  readonly node: FlattenedPlannerNode;
  readonly dayNumber?: number;
  readonly itemRef: (element: HTMLLIElement | null) => void;
  readonly boundaryAncestor?: FlattenedPlannerNode;
  readonly previousActivity?: PlannerActivityNode;
  readonly isChildTarget: boolean;
  readonly isExpandingTarget: boolean;
  readonly isSiblingDropActive: boolean;
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
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
    id: node.pathId,
    disabled: !isSortable,
  });
  const hasChildren = (childrenMap.get(node.pathId) ?? []).length > 0;
  const isExpanded = expandedIds.has(node.pathId);
  // Shift 선택 중에는 정규화된 작업 대상만 강하게 표시한다. anchor는 범위 계산 기준으로만 남긴다.
  const isSelected =
    multiSelectedIds.length > 0
      ? multiSelectedIds.includes(node.pathId)
      : selectedItemId === node.pathId;
  // 선택 이후 펼쳐진 자손도 실제 작업 대상에 포함된다는 의미를 연한 배경으로 이어서 보여 준다.
  const isSelectionContext =
    !isSelected &&
    (selectionRangeIds.includes(node.pathId) ||
      hasSelectedAncestor(node, multiSelectedIds, entityMap));
  // 선택 상태는 유지하되 drag overlay와 중복 강조되지 않도록 목록 배경만 숨긴다.
  const isSelectedHighlightVisible = isSelected && !suppressSelectionHighlight;
  const isSelectionContextHighlightVisible = isSelectionContext && !suppressSelectionHighlight;
  const isMapHovered = hoveredItemId === node.pathId;
  // 기존 Planner와 같이 root 다음 계층부터 30px 단위로 들여쓴다.
  // 별도의 20px 토글 칸을 항상 유지해 자식 유무와 관계없이 라벨 시작점을 맞춘다.
  const indentation = Math.max(0, node.depth - 1) * 30;
  const isEditingName = nameEditing.editingPathId === node.pathId;
  const canRename = node.kind === "folder" || node.kind === "day";
  const operationPathIds = multiSelectedIds.includes(node.pathId)
    ? multiSelectedIds
    : [node.pathId];

  return (
    <li
      ref={(element) => {
        setNodeRef(element);
        itemRef(element);
      }}
      {...attributes}
      {...listeners}
      role="treeitem"
      aria-expanded={hasChildren ? isExpanded : undefined}
      aria-selected={isSelected}
      data-selection-state={isSelected ? "selected" : isSelectionContext ? "range" : undefined}
      data-map-highlight={isMapHovered ? "hovered" : undefined}
      data-drop-state={isChildTarget ? "child" : isExpandingTarget ? "expanding" : undefined}
      className={`relative touch-none list-none ${
        isSortable ? "cursor-grab active:cursor-grabbing" : "cursor-default"
      }`}
      style={{
        opacity: isDragging ? 0 : 1,
        transform: CSS.Transform.toString(isSiblingDropActive ? transform : null),
        transition,
      }}
    >
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
      {node.kind === "activity" && previousActivity ? (
        <PlannerRouteInfo
          activity={node}
          previousActivity={previousActivity}
          indentation={indentation}
        />
      ) : null}
      <PlannerTreeItemContextMenu
        node={node}
        commands={commands}
        operationPathIds={operationPathIds}
        onBeginEditing={nameEditing.begin}
        trigger={
          <div
            className={`group flex h-9 items-center border-l-2 transition-colors ${
              isChildTarget
                ? "planner-child-drop-fill border-brand text-foreground"
                : isExpandingTarget
                  ? "border-brand/60 bg-brand/5 text-foreground"
                  : isSelectedHighlightVisible
                    ? "border-brand bg-brand/10 text-foreground"
                    : isMapHovered
                      ? "border-brand/70 bg-brand/10 text-foreground"
                      : isSelectionContextHighlightVisible
                        ? "border-transparent bg-brand/5 text-foreground hover:bg-brand/10"
                        : "border-transparent text-foreground hover:bg-muted/70"
            }`}
            style={{ paddingLeft: indentation }}
            onPointerEnter={() => setHoveredItem(node.pathId)}
            onPointerLeave={() => {
              if (usePlannerViewStore.getState().hoveredItemId === node.pathId) {
                setHoveredItem(null);
              }
            }}
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
                    // 범위 선택은 선택 상태만 바꾸고 지도 카메라는 이동하지 않는다.
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
        />
      ) : null}
    </li>
  );
}
