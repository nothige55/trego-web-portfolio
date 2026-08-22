import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import { useCallback, useMemo, useRef, useState } from "react";

import { PlannerBreadcrumb } from "@/features/planner/components/planner-breadcrumb";
import { PlannerDragPreview } from "@/features/planner/components/planner-drag-preview";
import { PlannerScheduleHeader } from "@/features/planner/components/planner-schedule-header";
import { PlannerScheduleToolbar } from "@/features/planner/components/planner-schedule-toolbar";
import { PlannerTreeItem } from "@/features/planner/components/planner-tree-item";
import { calculatePlannerDragFootprintHeight } from "@/features/planner/dnd/resolve-planner-drop";
import { usePlannerDragAndDrop } from "@/features/planner/dnd/use-planner-drag-and-drop";
import { usePlannerMemoEditing } from "@/features/planner/hooks/use-planner-memo-editing";
import { usePlannerNameEditing } from "@/features/planner/hooks/use-planner-name-editing";
import { usePlannerScheduleScroll } from "@/features/planner/hooks/use-planner-schedule-scroll";
import { usePlannerShortcuts } from "@/features/planner/hooks/use-planner-shortcuts";
import { usePlannerViewStore } from "@/features/planner/stores/planner-view-store";
import type {
  PlannerNodeEditingCommands,
  PlannerNodeMoveHandler,
} from "@/features/planner/types/planner-editing-commands";
import type { PlannerNodePathId } from "@/features/planner/types/planner-node";
import { buildPlannerDayNumbers } from "@/features/planner/utils/build-planner-day-numbers";
import { getPlannerBreadcrumbAncestors } from "@/features/planner/utils/get-planner-breadcrumb-ancestors";
import { getPlannerRowAdornments } from "@/features/planner/utils/get-planner-row-adornments";
import { getVisiblePlannerNodes } from "@/features/planner/utils/get-visible-planner-nodes";

// 이 파일은 일정 트리의 조합만 담당한다.
// 행 렌더링은 PlannerTreeItem, 편집·스크롤·단축키 상태는 planner/hooks, 파생 계산은 planner/utils에 둔다.
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
  const rootPathId = usePlannerViewStore((state) => state.rootPathId);
  const selectedItemId = usePlannerViewStore((state) => state.selectedItemId);
  const multiSelectedIds = usePlannerViewStore((state) => state.multiSelectedIds);
  const expandedIds = usePlannerViewStore((state) => state.expandedIds);
  const clearSelection = usePlannerViewStore((state) => state.clearSelection);
  const expandNode = usePlannerViewStore((state) => state.expandNode);
  const itemRefs = useRef(new Map<PlannerNodePathId, HTMLLIElement>());
  const getItemElement = useCallback(
    (pathId: PlannerNodePathId): HTMLLIElement | null => itemRefs.current.get(pathId) ?? null,
    [],
  );
  const [dragFootprintHeight, setDragFootprintHeight] = useState(0);
  const nameEditing = usePlannerNameEditing(commands);
  const memoEditing = usePlannerMemoEditing(commands);
  // 메모 편집기는 행 안에서 열리므로 여는 동작만 command 묶음에 끼워 하위로 내려보낸다.
  const commandBindings = commands
    ? { ...commands, editActivityMemo: memoEditing.open }
    : undefined;
  const visibleItems = useMemo(
    () => getVisiblePlannerNodes(tree.flattenedItems, expandedIds, tree.childrenMap),
    [expandedIds, tree.childrenMap, tree.flattenedItems],
  );
  // root는 프로젝트 컨테이너이므로 탐색 순서에는 사용하되 목록에서는 숨긴다.
  const renderedItems = useMemo(
    () => visibleItems.filter((item) => item.pathId !== rootPathId),
    [rootPathId, visibleItems],
  );
  const dayNumberByPathId = useMemo(
    () => buildPlannerDayNumbers(tree.flattenedItems, projectDetails?.startDate),
    [projectDetails?.startDate, tree.flattenedItems],
  );
  const operationPathIds = useMemo(
    () => (multiSelectedIds.length > 0 ? multiSelectedIds : selectedItemId ? [selectedItemId] : []),
    [multiSelectedIds, selectedItemId],
  );
  usePlannerShortcuts({ commands, operationPathIds });
  const { scrollContainerRef, topItemId, updateTopItem } = usePlannerScheduleScroll({
    items: renderedItems,
    getItemElement,
  });
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
        (itemPathId) => getItemElement(itemPathId)?.offsetHeight ?? 0,
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
  // 미리보기도 행과 같은 기준으로 경로 정보 유무를 판단해야 시작 위치가 어긋나지 않는다.
  const activeRowAdornments = activeNode
    ? getPlannerRowAdornments({
        node: activeNode,
        tree,
        rootPathId,
        topItemId,
        isDragging: true,
      })
    : undefined;
  const breadcrumbAncestors = useMemo(
    () => getPlannerBreadcrumbAncestors(topItemId, rootPathId, tree.entityMap),
    [rootPathId, topItemId, tree.entityMap],
  );
  const topItemIndex = topItemId
    ? renderedItems.findIndex((item) => item.pathId === topItemId)
    : -1;
  const isNextRootChild = topItemIndex >= 0 && renderedItems[topItemIndex + 1]?.depth === 1;
  const visibleBreadcrumbAncestors = isNextRootChild ? [] : breadcrumbAncestors;

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
      <PlannerScheduleHeader
        projectDetails={projectDetails}
        onUpdateDateRange={commands?.updateDateRange}
      />

      <div className="relative min-h-0 flex-1">
        <PlannerScheduleToolbar commands={commands} />
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
                  const { boundaryAncestor, previousActivity } = getPlannerRowAdornments({
                    node,
                    nextNode: sortableItems[index + 1],
                    tree,
                    rootPathId,
                    topItemId,
                    isDragging: activePathId !== null,
                  });

                  return (
                    <PlannerTreeItem
                      key={node.pathId}
                      node={node}
                      dayNumber={dayNumberByPathId.get(node.pathId)}
                      boundaryAncestor={boundaryAncestor}
                      previousActivity={previousActivity}
                      isChildTarget={childTargetPathId === node.pathId}
                      isExpandingTarget={expandingTargetPathId === node.pathId}
                      isSiblingDropActive={isSiblingDropActive}
                      isSortable={isNodeMoveEnabled}
                      suppressSelectionHighlight={activePathId !== null}
                      commands={commandBindings}
                      nameEditing={nameEditing}
                      memoEditing={memoEditing}
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
                <PlannerDragPreview
                  node={activeNode}
                  dayNumber={dayNumberByPathId.get(activeNode.pathId)}
                  previousActivity={activeRowAdornments?.previousActivity}
                />
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
