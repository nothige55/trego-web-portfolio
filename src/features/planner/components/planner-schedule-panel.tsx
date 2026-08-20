import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Group,
  ListChevronsDownUp,
  Pencil,
  Redo2,
  Trash2,
  Undo2,
} from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { DayMapVisibilityToggle } from "@/features/planner/components/day-map-visibility-toggle";
import {
  PLANNER_BREADCRUMB_HEIGHT,
  PlannerBreadcrumb,
} from "@/features/planner/components/planner-breadcrumb";
import { PlannerDateRangePopover } from "@/features/planner/components/planner-date-range-popover";
import { PlannerNodeCreateDialog } from "@/features/planner/components/planner-node-create-dialog";
import { PlannerNodeLabel } from "@/features/planner/components/planner-node-label";
import { PlannerRouteInfo } from "@/features/planner/components/planner-route-info";
import { PLANNER_DAY_COLORS } from "@/features/planner/data/planner-day-colors";
import type { PlannerDropDestination } from "@/features/planner/dnd/planner-drop-rules";
import { calculatePlannerDragFootprintHeight } from "@/features/planner/dnd/resolve-planner-drop";
import { usePlannerDragAndDrop } from "@/features/planner/dnd/use-planner-drag-and-drop";
import type { PlannerDateRangeInput } from "@/features/planner/operations/planner-date-range";
import type { PlannerCreateNodeDraft } from "@/features/planner/operations/planner-operations";
import type { PlannerRealtimeCommands } from "@/features/planner/realtime/planner-realtime";
import { usePlannerHistoryStore } from "@/features/planner/stores/planner-history-store";
import { usePlannerViewStore } from "@/features/planner/stores/planner-view-store";
import type {
  FlattenedPlannerNode,
  PlannerActivityNode,
  PlannerNodePathId,
} from "@/features/planner/types/planner-node";
import { getPlannerBreadcrumbAncestors } from "@/features/planner/utils/get-planner-breadcrumb-ancestors";
import { getVisiblePlannerNodes } from "@/features/planner/utils/get-visible-planner-nodes";

// 이 파일은 일정 트리의 표시와 사용자 입력만 담당한다.
// 트리 생성, visible item 계산, 계층 선택 규칙은 각각 store와 순수 함수에 둔다.
const VISIBLE_DAY_COLOR_COUNT = 4;

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

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

function PlannerTreeItem({
  node,
  dayNumber,
  itemRef,
  boundaryAncestor,
  isChildTarget,
  isExpandingTarget,
  isSiblingDropActive,
  isSortable,
  suppressSelectionHighlight,
  commands,
  editingPathId,
  editingName,
  isMemoEditing,
  isMemoSubmitting,
  memoDraft,
  memoError,
  previousActivity,
  onBeginEditing,
  onCancelMemoEditing,
  onCancelEditing,
  onEditingNameChange,
  onCommitName,
  onMemoDraftChange,
  onSaveMemo,
}: {
  readonly node: FlattenedPlannerNode;
  readonly dayNumber?: number;
  readonly itemRef: (element: HTMLLIElement | null) => void;
  readonly boundaryAncestor?: FlattenedPlannerNode;
  readonly isChildTarget: boolean;
  readonly isExpandingTarget: boolean;
  readonly isSiblingDropActive: boolean;
  readonly isSortable: boolean;
  readonly suppressSelectionHighlight: boolean;
  readonly commands?: PlannerNodeEditingCommands;
  readonly editingPathId: PlannerNodePathId | null;
  readonly editingName: string;
  readonly isMemoEditing: boolean;
  readonly isMemoSubmitting: boolean;
  readonly memoDraft: string;
  readonly memoError: string | null;
  readonly previousActivity?: PlannerActivityNode;
  readonly onBeginEditing: (node: FlattenedPlannerNode) => void;
  readonly onCancelMemoEditing: () => void;
  readonly onCancelEditing: () => void;
  readonly onEditingNameChange: (name: string) => void;
  readonly onCommitName: (node: FlattenedPlannerNode) => void;
  readonly onMemoDraftChange: (memo: string) => void;
  readonly onSaveMemo: () => Promise<void>;
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
  const nameInputRef = useRef<HTMLInputElement>(null);
  const currentDayColorIndex = PLANNER_DAY_COLORS.findIndex((color) => color === node.color);
  const [dayColorStartIndex, setDayColorStartIndex] = useState(currentDayColorIndex);
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
  const isEditing = editingPathId === node.pathId;
  const canRename = node.kind === "folder" || node.kind === "day";
  const operationPathIds = multiSelectedIds.includes(node.pathId)
    ? multiSelectedIds
    : [node.pathId];

  useEffect(() => {
    if (!isEditing) {
      return;
    }

    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, [isEditing]);

  const visibleDayColors = Array.from(
    { length: VISIBLE_DAY_COLOR_COUNT },
    (_, offset) =>
      PLANNER_DAY_COLORS[modulo(dayColorStartIndex + offset, PLANNER_DAY_COLORS.length)],
  );

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
      <ContextMenu
        onOpenChange={(isOpen) => {
          if (isOpen) {
            setDayColorStartIndex(currentDayColorIndex);
          }
        }}
      >
        <ContextMenuTrigger
          render={
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
              isEditing ? (
                <span className="relative min-w-0 flex-1">
                  <span aria-hidden="true" className="invisible block truncate font-medium">
                    {node.name || "\u00a0"}
                  </span>
                  <input
                    ref={nameInputRef}
                    aria-label={`${node.name} 이름`}
                    value={editingName}
                    className="absolute -inset-y-2 right-0 -left-2 h-[30px] min-w-0 rounded-lg bg-brand/10 px-2 text-sm leading-none font-medium ring-1 ring-brand outline-none ring-inset"
                    onBlur={onCancelEditing}
                    onChange={(event) => onEditingNameChange(event.target.value)}
                    onClick={(event) => event.stopPropagation()}
                    onDoubleClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => {
                      event.stopPropagation();

                      if (event.key === "Enter") {
                        event.preventDefault();
                        onCommitName(node);
                      } else if (event.key === "Escape") {
                        event.preventDefault();
                        onCancelEditing();
                      }
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                  />
                </span>
              ) : undefined
            }
            onClick={
              isEditing
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
                    onBeginEditing(node);
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
        </ContextMenuTrigger>
        {commands ? (
          <ContextMenuContent className="z-100">
            {canRename ? (
              <ContextMenuItem onClick={() => onBeginEditing(node)}>
                <Pencil aria-hidden="true" />
                이름 변경
              </ContextMenuItem>
            ) : null}
            {node.kind === "activity" ? (
              <ContextMenuItem onClick={() => commands.editActivityMemo?.(node.pathId)}>
                <Pencil aria-hidden="true" />
                메모 편집
              </ContextMenuItem>
            ) : null}
            {operationPathIds.length >= 2 && commands.groupNodes ? (
              <ContextMenuItem
                onClick={() => void commands.groupNodes?.(operationPathIds).catch(() => undefined)}
              >
                <Group aria-hidden="true" />
                선택 일정 그룹화
              </ContextMenuItem>
            ) : null}
            {node.kind === "day" ? (
              <div aria-label="Day 색상 선택" className="flex items-center gap-1 p-1" role="group">
                <ContextMenuItem
                  aria-label="이전 Day 색상"
                  className="size-8 justify-center rounded-full p-1"
                  closeOnClick={false}
                  onClick={() => setDayColorStartIndex((current) => current - 1)}
                >
                  <ChevronLeft aria-hidden="true" />
                </ContextMenuItem>
                <div className="flex items-center gap-2">
                  {visibleDayColors.map((color) => (
                    <ContextMenuItem
                      key={color}
                      aria-label={`색상 ${color} 선택`}
                      className="size-6 justify-center p-1"
                      closeOnClick={false}
                      onClick={() => {
                        void commands
                          .updateDay({ id: node.id, name: node.name, color })
                          .catch(() => undefined);
                      }}
                    >
                      <span
                        aria-hidden="true"
                        className={`size-4 rounded-sm ${node.color === color ? "ring-2 ring-foreground ring-offset-1" : ""}`}
                        style={{ backgroundColor: color }}
                      />
                    </ContextMenuItem>
                  ))}
                </div>
                <ContextMenuItem
                  aria-label="다음 Day 색상"
                  className="size-8 justify-center rounded-full p-1"
                  closeOnClick={false}
                  onClick={() => setDayColorStartIndex((current) => current + 1)}
                >
                  <ChevronRight aria-hidden="true" />
                </ContextMenuItem>
              </div>
            ) : null}
            {canRename ? <ContextMenuSeparator /> : null}
            <ContextMenuItem
              variant="destructive"
              onClick={() => {
                const operation = commands.deleteNodes
                  ? commands.deleteNodes(operationPathIds)
                  : commands.deleteNode({ pathId: node.pathId });
                void operation.catch(() => undefined);
              }}
            >
              <Trash2 aria-hidden="true" />
              {operationPathIds.length > 1 ? `${operationPathIds.length}개 삭제` : "삭제"}
            </ContextMenuItem>
          </ContextMenuContent>
        ) : null}
      </ContextMenu>
      {node.kind === "activity" && (node.memo || isMemoEditing) ? (
        <div
          className="border-l-2 border-transparent pr-2 pb-2"
          style={{ paddingLeft: indentation + 44 }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {isMemoEditing ? (
            <div className="space-y-1.5">
              <textarea
                autoFocus
                aria-label="Activity 메모"
                className="min-h-20 w-full resize-y rounded-md border bg-background px-2.5 py-2 text-xs leading-relaxed outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                disabled={isMemoSubmitting}
                value={memoDraft}
                onChange={(event) => onMemoDraftChange(event.target.value)}
                onKeyDown={(event) => {
                  event.stopPropagation();

                  if (event.key === "Escape") {
                    event.preventDefault();
                    onCancelMemoEditing();
                  } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    void onSaveMemo();
                  }
                }}
              />
              {memoError ? (
                <p className="text-xs text-destructive" role="alert">
                  {memoError}
                </p>
              ) : null}
              <div className="flex justify-end gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={isMemoSubmitting}
                  onClick={onCancelMemoEditing}
                >
                  취소
                </Button>
                <Button
                  type="button"
                  size="xs"
                  disabled={isMemoSubmitting}
                  onClick={() => void onSaveMemo()}
                >
                  {isMemoSubmitting ? "저장 중…" : "저장"}
                </Button>
              </div>
            </div>
          ) : commands ? (
            <button
              type="button"
              aria-label={`${node.name} 메모 편집`}
              className="block w-full text-left text-xs leading-relaxed break-words whitespace-pre-wrap text-muted-foreground hover:text-foreground"
              onClick={() => commands.editActivityMemo?.(node.pathId)}
            >
              {node.memo}
            </button>
          ) : (
            <p className="text-xs leading-relaxed break-words whitespace-pre-wrap text-muted-foreground">
              {node.memo}
            </p>
          )}
        </div>
      ) : null}
    </li>
  );
}

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

type PlannerSchedulePanelProps = {
  readonly commands?: PlannerNodeEditingCommands;
  readonly isNodeMoveEnabled: boolean;
  readonly onMoveNode: PlannerNodeMoveHandler;
};

export function PlannerSchedulePanel({
  commands,
  isNodeMoveEnabled,
  onMoveNode,
}: PlannerSchedulePanelProps) {
  const projectDetails = usePlannerViewStore((state) => state.projectDetails);
  const tree = usePlannerViewStore((state) => state.tree);
  const nodes = usePlannerViewStore((state) => state.nodes);
  const rootPathId = usePlannerViewStore((state) => state.rootPathId);
  const selectedItemId = usePlannerViewStore((state) => state.selectedItemId);
  const multiSelectedIds = usePlannerViewStore((state) => state.multiSelectedIds);
  const expandedIds = usePlannerViewStore((state) => state.expandedIds);
  const collapseAll = usePlannerViewStore((state) => state.collapseAll);
  const clearSelection = usePlannerViewStore((state) => state.clearSelection);
  const expandNode = usePlannerViewStore((state) => state.expandNode);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<PlannerNodePathId, HTMLLIElement>());
  const [topItemId, setTopItemId] = useState<PlannerNodePathId | null>(null);
  const [dragFootprintHeight, setDragFootprintHeight] = useState(0);
  const [editingPathId, setEditingPathId] = useState<PlannerNodePathId | null>(null);
  const [editingName, setEditingName] = useState("");
  const [memoEditingPathId, setMemoEditingPathId] = useState<PlannerNodePathId | null>(null);
  const [memoDraft, setMemoDraft] = useState("");
  const [memoError, setMemoError] = useState<string | null>(null);
  const [isMemoSubmitting, setIsMemoSubmitting] = useState(false);
  const historyPastCount = usePlannerHistoryStore((state) => state.past.length);
  const historyFutureCount = usePlannerHistoryStore((state) => state.future.length);
  const isHistoryReplaying = usePlannerHistoryStore((state) => state.isReplaying);
  const memoEditingNode = memoEditingPathId ? tree.entityMap.get(memoEditingPathId) : undefined;
  const beginEditing = (node: FlattenedPlannerNode): void => {
    setEditingPathId(node.pathId);
    setEditingName(node.name);
  };
  const cancelEditing = (): void => {
    setEditingPathId(null);
    setEditingName("");
  };
  const commitName = (node: FlattenedPlannerNode): void => {
    if (!commands) {
      cancelEditing();
      return;
    }

    const nextName = editingName.trim();
    cancelEditing();

    if (!nextName || nextName === node.name) {
      return;
    }

    if (node.kind === "activity") return;

    const operation =
      node.kind === "folder"
        ? commands.updateFolder({
            id: node.id,
            name: nextName,
            folderType: node.folderType ?? "default",
          })
        : commands.updateDay({ id: node.id, name: nextName, color: node.color ?? "#F44336" });
    void operation.catch(() => undefined);
  };
  const openMemoEditor = (pathId: PlannerNodePathId): void => {
    const node = tree.entityMap.get(pathId);
    if (node?.kind !== "activity") return;
    setMemoEditingPathId(pathId);
    setMemoDraft(node.memo ?? "");
    setMemoError(null);
  };
  const cancelMemoEditing = (): void => {
    setMemoEditingPathId(null);
    setMemoDraft("");
    setMemoError(null);
  };
  const saveMemo = async (): Promise<void> => {
    if (!commands || memoEditingNode?.kind !== "activity") return;

    setIsMemoSubmitting(true);
    setMemoError(null);
    try {
      await commands.updateActivity({
        id: memoEditingNode.id,
        name: memoEditingNode.name,
        memo: memoDraft.trim() || null,
      });
      cancelMemoEditing();
    } catch {
      setMemoError("메모를 저장하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setIsMemoSubmitting(false);
    }
  };
  const commandBindings = commands ? { ...commands, editActivityMemo: openMemoEditor } : undefined;
  const visibleItems = useMemo(
    () => getVisiblePlannerNodes(tree.flattenedItems, expandedIds, tree.childrenMap),
    [expandedIds, tree.childrenMap, tree.flattenedItems],
  );
  useLayoutEffect(() => {
    if (!selectedItemId) return;
    const selectedElement = itemRefs.current.get(selectedItemId);
    if (typeof selectedElement?.scrollIntoView === "function") {
      selectedElement.scrollIntoView({ block: "nearest" });
    }
  }, [selectedItemId, visibleItems]);
  const dayNumberByPathId = useMemo(() => {
    const startDateValue = projectDetails?.startDate.slice(0, 10) ?? "1970-01-01";
    const startDate = new Date(`${startDateValue}T00:00:00Z`);
    const dayNumbers = new Map<PlannerNodePathId, number>();
    let dayOffset = 0;

    tree.flattenedItems.forEach((node) => {
      if (node.kind !== "day") {
        return;
      }

      const date = new Date(startDate);
      date.setUTCDate(startDate.getUTCDate() + dayOffset);
      dayNumbers.set(node.pathId, date.getUTCDate());
      dayOffset += 1;
    });

    return dayNumbers;
  }, [projectDetails?.startDate, tree.flattenedItems]);
  // root는 프로젝트 컨테이너이므로 탐색 순서에는 사용하되 목록에서는 숨긴다.
  const renderedItems = useMemo(
    () => visibleItems.filter((item) => item.pathId !== rootPathId),
    [rootPathId, visibleItems],
  );
  const operationPathIds = useMemo(
    () => (multiSelectedIds.length > 0 ? multiSelectedIds : selectedItemId ? [selectedItemId] : []),
    [multiSelectedIds, selectedItemId],
  );
  useEffect(() => {
    const handlePlannerKeyDown = (event: KeyboardEvent): void => {
      const target = event.target;
      const isTextInput =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable);
      if (isTextInput || event.isComposing) return;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        const historyCommand = event.shiftKey ? commands?.redo : commands?.undo;
        if (!historyCommand) return;
        event.preventDefault();
        void historyCommand().catch(() => undefined);
        return;
      }

      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "g" &&
        operationPathIds.length >= 2 &&
        commands?.groupNodes
      ) {
        event.preventDefault();
        void commands.groupNodes(operationPathIds).catch(() => undefined);
        return;
      }

      if ((event.key === "Delete" || event.key === "Backspace") && operationPathIds.length > 0) {
        const deleteOperation = commands?.deleteNodes
          ? () => commands.deleteNodes!(operationPathIds)
          : operationPathIds.length === 1 && commands?.deleteNode
            ? () => commands.deleteNode({ pathId: operationPathIds[0]! })
            : null;
        if (!deleteOperation) return;
        event.preventDefault();
        void deleteOperation().catch(() => undefined);
        return;
      }

      if (event.key === "Escape") clearSelection();
    };

    window.addEventListener("keydown", handlePlannerKeyDown);
    return () => window.removeEventListener("keydown", handlePlannerKeyDown);
  }, [clearSelection, commands, operationPathIds]);
  const moveNode = useCallback<PlannerNodeMoveHandler>(
    (pathId, destination) => {
      if (isNodeMoveEnabled) {
        onMoveNode(pathId, destination);
      }
    },
    [isNodeMoveEnabled, onMoveNode],
  );
  const {
    activePathId,
    childTargetPathId,
    expandingTargetPathId,
    handleDragCancel,
    handleDragEnd,
    handleDragMove,
    handleDragStart,
    isSiblingDropActive,
    sensors,
    sortableItems,
  } = usePlannerDragAndDrop({
    tree,
    rootPathId,
    visibleItems: renderedItems,
    expandedIds,
    expandNode,
    moveNode,
  });
  const handlePanelDragStart = (event: DragStartEvent): void => {
    const pathId = String(event.active.id);
    setDragFootprintHeight(
      calculatePlannerDragFootprintHeight(
        renderedItems,
        pathId,
        (itemPathId) => itemRefs.current.get(itemPathId)?.offsetHeight ?? 0,
      ),
    );
    handleDragStart(event);
  };
  const handlePanelDragEnd = (event: DragEndEvent): void => {
    setDragFootprintHeight(0);
    handleDragEnd(event);
  };
  const handlePanelDragCancel = (): void => {
    setDragFootprintHeight(0);
    handleDragCancel();
  };
  const activeNode = activePathId ? tree.entityMap.get(activePathId) : undefined;
  const breadcrumbAncestors = useMemo(
    () => getPlannerBreadcrumbAncestors(topItemId, rootPathId, tree.entityMap),
    [rootPathId, topItemId, tree.entityMap],
  );
  const topItemIndex = topItemId
    ? renderedItems.findIndex((item) => item.pathId === topItemId)
    : -1;
  const isNextRootChild = topItemIndex >= 0 && renderedItems[topItemIndex + 1]?.depth === 1;
  const visibleBreadcrumbAncestors = isNextRootChild ? [] : breadcrumbAncestors;
  const updateTopItem = useCallback(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) {
      return;
    }

    const threshold = scrollContainer.getBoundingClientRect().top + PLANNER_BREADCRUMB_HEIGHT;
    let nextTopItemId: PlannerNodePathId | null = null;

    // breadcrumb 영역을 지난 마지막 노드를 현재 행으로 삼고, breadcrumb에는 그 조상만 표시한다.
    for (const item of renderedItems) {
      const element = itemRefs.current.get(item.pathId);
      if (!element || element.getBoundingClientRect().top > threshold) {
        break;
      }
      nextTopItemId = item.pathId;
    }

    setTopItemId((currentTopItemId) =>
      currentTopItemId === nextTopItemId ? currentTopItemId : nextTopItemId,
    );
  }, [renderedItems]);
  useLayoutEffect(() => {
    updateTopItem();
  }, [updateTopItem]);
  const rootChildren = rootPathId ? (tree.childrenMap.get(rootPathId) ?? []) : [];
  // 접힌 부모 아래의 펼침 상태는 복원용으로 보존하되 버튼 노출에는 사용하지 않는다.
  const hasExpandedTopLevelBranch = rootChildren.some(
    (node) => expandedIds.has(node.pathId) && (tree.childrenMap.get(node.pathId)?.length ?? 0) > 0,
  );
  const getTopAncestor = (item: FlattenedPlannerNode): FlattenedPlannerNode => {
    let currentItem = item;

    while (currentItem.parentPathId) {
      const parent = tree.entityMap.get(currentItem.parentPathId);
      if (!parent || parent.pathId === rootPathId) {
        break;
      }
      currentItem = parent;
    }

    return currentItem;
  };
  const isAloneAndRootChild = (item: FlattenedPlannerNode): boolean => {
    const siblings = tree.childrenMap.get(item.parentPathId) ?? [];
    return siblings.length === 1 && item.depth === 2;
  };

  if (!projectDetails) {
    return (
      <aside
        aria-label="일정 패널"
        className="z-20 flex h-full w-80 shrink-0 items-center justify-center border-r bg-card p-6 text-card-foreground"
      >
        <p role="status" className="text-sm text-muted-foreground">
          여행 일정 정보를 불러오는 중입니다.
        </p>
      </aside>
    );
  }

  return (
    <aside
      aria-label="일정 패널"
      className="z-20 flex h-full w-80 shrink-0 flex-col border-r bg-card text-card-foreground"
    >
      <header className="border-b px-6 py-4">
        <p className="text-xs font-semibold tracking-wide text-brand">Trego Planner</p>
        <div className="mt-2 flex items-start justify-between gap-3">
          <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{projectDetails.title}</h1>
          {commands?.updateDateRange ? (
            <PlannerDateRangePopover
              nodes={nodes}
              orderedPathIds={tree.flattenedItems.map((node) => node.pathId)}
              projectDetails={projectDetails}
              onUpdate={commands.updateDateRange}
            />
          ) : (
            <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground tabular-nums">
              {projectDetails.startDate.slice(5, 10).replace("-", ".")} –{" "}
              {projectDetails.endDate.slice(5, 10).replace("-", ".")}
            </span>
          )}
        </div>
        <p className="mt-1 w-full text-xs text-muted-foreground">
          실시간으로 일정을 함께 편집합니다.
        </p>
      </header>

      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-x-0 top-0 z-50 flex h-8 items-center justify-between bg-card px-6 pr-2 text-sm font-medium">
          <span>일정</span>
          <div className="flex items-center gap-0.5">
            {commands?.undo ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="실행 취소"
                disabled={historyPastCount === 0 || isHistoryReplaying}
                onClick={() => void commands.undo?.().catch(() => undefined)}
              >
                <Undo2 aria-hidden="true" />
              </Button>
            ) : null}
            {commands?.redo ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="다시 실행"
                disabled={historyFutureCount === 0 || isHistoryReplaying}
                onClick={() => void commands.redo?.().catch(() => undefined)}
              >
                <Redo2 aria-hidden="true" />
              </Button>
            ) : null}
            {commands?.createNode && commands.extendDateRange && rootPathId ? (
              <PlannerNodeCreateDialog
                rootPathId={rootPathId}
                onCreate={commands.createNode}
                onExtendDateRange={commands.extendDateRange}
              />
            ) : null}
            {hasExpandedTopLevelBranch ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6"
                aria-label="모든 일정 접기"
                onClick={collapseAll}
              >
                <ListChevronsDownUp aria-hidden="true" className="size-3.5" />
              </Button>
            ) : null}
          </div>
        </div>
        <div
          ref={scrollContainerRef}
          data-testid="planner-schedule-scroll-area"
          className="scrollbar-hide h-full overflow-y-auto pb-5"
          onScroll={updateTopItem}
        >
          <PlannerBreadcrumb
            ancestors={visibleBreadcrumbAncestors}
            dayNumberByPathId={dayNumberByPathId}
            entityMap={tree.entityMap}
          />
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragCancel={handlePanelDragCancel}
            onDragEnd={handlePanelDragEnd}
            onDragMove={handleDragMove}
            onDragStart={handlePanelDragStart}
          >
            <SortableContext items={sortableItems.map((node) => node.pathId)}>
              <ul
                role="tree"
                aria-label="여행 일정"
                className="min-h-full outline-none"
                tabIndex={0}
                onClick={(event) => {
                  // 노드 클릭의 bubbling으로 선택이 풀리지 않도록 실제 빈 영역만 처리한다.
                  if (event.target === event.currentTarget) {
                    clearSelection();
                  }
                }}
                onKeyDown={(event) => {
                  if (event.target === event.currentTarget && event.key === "Escape") {
                    clearSelection();
                  }
                }}
              >
                {sortableItems.length === 0 ? (
                  <li className="px-6 pt-12 text-sm text-muted-foreground">
                    아직 등록된 일정이 없습니다.
                  </li>
                ) : null}
                {sortableItems.map((node, index) => {
                  const nextItem = sortableItems[index + 1];
                  const parent = node.parentPathId
                    ? tree.entityMap.get(node.parentPathId)
                    : undefined;
                  const siblings = tree.childrenMap.get(node.parentPathId) ?? [];
                  const siblingIndex = siblings.findIndex(
                    (sibling) => sibling.pathId === node.pathId,
                  );
                  const previousSibling = siblingIndex > 0 ? siblings[siblingIndex - 1] : undefined;
                  const previousActivity =
                    node.kind === "activity" &&
                    node.activityType !== "group" &&
                    parent?.kind === "day" &&
                    previousSibling?.kind === "activity" &&
                    previousSibling.activityType !== "group"
                      ? previousSibling
                      : undefined;
                  const boundaryAncestor =
                    !activePathId &&
                    nextItem?.depth === 1 &&
                    node.pathId === topItemId &&
                    node.depth !== 1 &&
                    !isAloneAndRootChild(node)
                      ? getTopAncestor(node)
                      : undefined;

                  return (
                    <PlannerTreeItem
                      key={node.pathId}
                      node={node}
                      dayNumber={dayNumberByPathId.get(node.pathId)}
                      boundaryAncestor={boundaryAncestor}
                      isChildTarget={childTargetPathId === node.pathId}
                      isExpandingTarget={expandingTargetPathId === node.pathId}
                      isSiblingDropActive={isSiblingDropActive}
                      isSortable={isNodeMoveEnabled}
                      suppressSelectionHighlight={activePathId !== null}
                      commands={commandBindings}
                      editingPathId={editingPathId}
                      editingName={editingName}
                      isMemoEditing={memoEditingPathId === node.pathId}
                      isMemoSubmitting={isMemoSubmitting}
                      memoDraft={memoEditingPathId === node.pathId ? memoDraft : ""}
                      memoError={memoEditingPathId === node.pathId ? memoError : null}
                      previousActivity={previousActivity}
                      onBeginEditing={beginEditing}
                      onCancelMemoEditing={cancelMemoEditing}
                      onCancelEditing={cancelEditing}
                      onEditingNameChange={setEditingName}
                      onCommitName={commitName}
                      onMemoDraftChange={setMemoDraft}
                      onSaveMemo={saveMemo}
                      itemRef={(element) => {
                        if (element) {
                          itemRefs.current.set(node.pathId, element);
                        } else {
                          itemRefs.current.delete(node.pathId);
                        }
                      }}
                    />
                  );
                })}
              </ul>
            </SortableContext>
            {activeNode ? (
              <DragOverlay>
                <div className="pointer-events-none w-80 bg-card">
                  <div
                    className="flex min-h-9 items-center border-l-2 border-brand bg-brand/10 text-foreground"
                    style={{ paddingLeft: Math.max(0, activeNode.depth - 1) * 30 }}
                  >
                    <span className="h-9 w-5 shrink-0" aria-hidden="true" />
                    <PlannerNodeLabel
                      node={activeNode}
                      dayNumber={dayNumberByPathId.get(activeNode.pathId)}
                      parent={
                        activeNode.parentPathId
                          ? tree.entityMap.get(activeNode.parentPathId)
                          : undefined
                      }
                      className="flex-1 py-2.5 pr-2"
                    />
                  </div>
                </div>
              </DragOverlay>
            ) : null}
          </DndContext>
          <div
            aria-hidden="true"
            data-testid="planner-drag-footprint-spacer"
            style={{ height: dragFootprintHeight }}
          />
        </div>
      </div>
    </aside>
  );
}
