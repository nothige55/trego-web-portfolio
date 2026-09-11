// 일정 트리를 조합하고, 드래그 중 행을 옮기는 데 필요한 측정값(행 ref, 노드 높이)을 소유
// 행 렌더링은 PlannerTreeItem, 편집·스크롤·단축키 상태는 planner/hooks, 파생 계산은 planner/utils에 둠

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragMoveEvent,
  DragOverlay,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useCallback, useMemo, useRef, useState } from "react";

import { PlannerBreadcrumb } from "@/features/planner/components/planner-breadcrumb";
import { PlannerDragPreview } from "@/features/planner/components/planner-drag-preview";
import {
  PLANNER_ROUTE_INFO_HEIGHT,
  PlannerRouteInfo,
} from "@/features/planner/components/planner-route-info";
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
import {
  buildPlannerDragVisualOrder,
  calculatePlannerDragOffsets,
} from "@/features/planner/utils/build-planner-drag-layout";
import { buildPlannerDragProjection } from "@/features/planner/utils/build-planner-drag-projection";
import { getPlannerBreadcrumbAncestors } from "@/features/planner/utils/get-planner-breadcrumb-ancestors";
import { getPlannerRowAdornments } from "@/features/planner/utils/get-planner-row-adornments";
import {
  getPlannerRouteHighlight,
  getPlannerSelectionState,
} from "@/features/planner/utils/get-planner-row-highlight";
import { getPlannerRowIndentation } from "@/features/planner/utils/get-planner-row-indentation";
import { getVisiblePlannerNodes } from "@/features/planner/utils/get-visible-planner-nodes";

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
  const selectionRangeIds = usePlannerViewStore((state) => state.selectionRangeIds);
  const expandedIds = usePlannerViewStore((state) => state.expandedIds);
  const clearSelection = usePlannerViewStore((state) => state.clearSelection);
  const expandNode = usePlannerViewStore((state) => state.expandNode);
  const itemRefs = useRef(new Map<PlannerNodePathId, HTMLDivElement>());
  const registerItem = useCallback(
    (pathId: PlannerNodePathId, element: HTMLDivElement | null): void => {
      if (element) {
        itemRefs.current.set(pathId, element);
      } else {
        itemRefs.current.delete(pathId);
      }
    },
    [],
  );
  const getItemElement = useCallback(
    (pathId: PlannerNodePathId): HTMLDivElement | null => itemRefs.current.get(pathId) ?? null,
    [],
  );
  // 노드가 떠나면 그 앞머리인 경로 정보도 함께 닫히므로 자리는 li 기준으로 잼
  const getItemBlockHeight = useCallback((pathId: PlannerNodePathId): number => {
    const element = itemRefs.current.get(pathId);
    if (!element) {
      return 0;
    }

    return element.parentElement?.offsetHeight ?? element.offsetHeight;
  }, []);
  const [dragFootprintHeight, setDragFootprintHeight] = useState(0);
  // 드래그 시작 때 잰 노드 박스 높이. 밀림 거리를 이 값으로 계산
  // offsetHeight는 transform과 무관해 드래그 중에도 바뀌지 않음
  const [dragNodeHeights, setDragNodeHeights] = useState<ReadonlyMap<PlannerNodePathId, number>>(
    () => new Map(),
  );
  const nameEditing = usePlannerNameEditing(commands);
  const memoEditing = usePlannerMemoEditing(commands);
  // 메모 편집기는 행 안에서 열리므로 여는 동작만 command 묶음에 끼워 하위로 내려보냄
  const commandBindings = commands
    ? { ...commands, editActivityMemo: memoEditing.open }
    : undefined;
  const visibleItems = useMemo(
    () => getVisiblePlannerNodes(tree.flattenedItems, expandedIds, tree.childrenMap),
    [expandedIds, tree.childrenMap, tree.flattenedItems],
  );
  // root는 프로젝트 컨테이너이므로 탐색 순서에는 사용하되 목록에서는 숨김
  const renderedItems = useMemo(
    () => visibleItems.filter((item) => item.pathId !== rootPathId),
    [rootPathId, visibleItems],
  );
  const dayNumberByPathId = useMemo(
    () => buildPlannerDayNumbers(tree.flattenedItems, projectDetails?.startDate),
    [projectDetails?.startDate, tree.flattenedItems],
  );
  const selection = { selectedItemId, multiSelectedIds, selectionRangeIds };
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
    dropDestination,
    expandingTargetPathId,
    handleDragCancel,
    handleDragEnd,
    handleDragMove,
    handleDragStart,
    isOutsideList,
    isSiblingDropActive,
    sensors,
    sortableItems,
  } = usePlannerDragAndDrop({
    tree,
    rootPathId,
    visibleItems: renderedItems,
    expandedIds,
    expandNode,
    getListBounds: useCallback(() => {
      const rect = scrollContainerRef.current?.getBoundingClientRect();
      return rect ? { left: rect.left, right: rect.right } : null;
    }, [scrollContainerRef]),
    moveNode,
  });
  const handlePanelDragStart = (event: DragStartEvent): void => {
    const pathId = String(event.active.id);
    setDragNodeHeights(
      new Map(
        [...itemRefs.current].map(([itemPathId, element]) => [itemPathId, element.offsetHeight]),
      ),
    );
    setDragFootprintHeight(
      calculatePlannerDragFootprintHeight(renderedItems, pathId, getItemBlockHeight),
    );
    handleDragStart(event);
  };
  const handlePanelDragMove = (event: DragMoveEvent): void => {
    // 드래그 중에 펼쳐져 새로 그려진 행은 시작 때 재지 못했으니 여기서 채움
    const additions: [PlannerNodePathId, number][] = [];
    for (const [itemPathId, element] of itemRefs.current) {
      if (!dragNodeHeights.has(itemPathId)) {
        additions.push([itemPathId, element.offsetHeight]);
      }
    }
    if (additions.length > 0) {
      setDragNodeHeights((previous) => new Map([...previous, ...additions]));
    }
    handleDragMove(event);
  };
  const handlePanelDragEnd = (event: DragEndEvent): void => {
    setDragFootprintHeight(0);
    setDragNodeHeights(new Map());
    handleDragEnd(event);
  };
  const handlePanelDragCancel = (): void => {
    setDragFootprintHeight(0);
    setDragNodeHeights(new Map());
    handleDragCancel();
  };
  const activeNode = activePathId ? tree.entityMap.get(activePathId) : undefined;
  // 드래그 중에는 목록이 "지금 놓으면" 보일 모습으로 그림
  // - 목록 밖: 잡은 노드를 빼고 구멍 없이 닫힌 일정
  // - 형제 사이 자리: 잡은 노드를 그 자리에 끼운 일정
  // - 그 밖(받아 주지 않는 자리, 컨테이너 안으로 넣는 중): 아무것도 옮기지 않음
  const dragLayout = useMemo(() => {
    if (!activePathId || (!isOutsideList && !(isSiblingDropActive && dropDestination))) {
      return null;
    }

    const projection = buildPlannerDragProjection({
      tree,
      activePathId,
      destination: isOutsideList ? null : dropDestination,
    });
    const visualRows = projection
      ? buildPlannerDragVisualOrder({
          rows: sortableItems,
          activePathId,
          projection,
          rootPathId,
          expandedIds,
        })
      : null;
    return projection && visualRows ? { projection, visualRows } : null;
  }, [
    activePathId,
    dropDestination,
    expandedIds,
    isOutsideList,
    isSiblingDropActive,
    rootPathId,
    sortableItems,
    tree,
  ]);
  const rowAdornments = useMemo(
    () =>
      new Map(
        sortableItems.map((node, index) => [
          node.pathId,
          getPlannerRowAdornments({
            node,
            nextNode: sortableItems[index + 1],
            tree,
            rootPathId,
            topItemId,
            isDragging: activePathId !== null,
            projection: dragLayout?.projection,
          }),
        ]),
      ),
    [activePathId, dragLayout, rootPathId, sortableItems, topItemId, tree],
  );
  // 레이아웃 높이는 그대로 두고 노드 박스만 옮김. dnd-kit이 시작 때 잰 rect가 끝까지
  // 유효하고, 경로 정보 칸이 생기거나 사라지는 것도 옮기는 거리 안에서 흡수됨
  const dragOffsets = useMemo(
    () =>
      dragLayout
        ? calculatePlannerDragOffsets({
            layoutRows: sortableItems,
            visualRows: dragLayout.visualRows,
            getNodeHeight: (pathId) => dragNodeHeights.get(pathId) ?? 0,
            hasLayoutSlot: (row) => rowAdornments.get(row.pathId)?.hasRouteSlot ?? false,
            hasVisualSlot: (row) => rowAdornments.get(row.pathId)?.showsRouteInfo ?? false,
            slotHeight: PLANNER_ROUTE_INFO_HEIGHT,
          })
        : null,
    [dragLayout, dragNodeHeights, rowAdornments, sortableItems],
  );
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
          {/* over는 포인터가 멈춰 있어도 리렌더로 다시 계산되는데 onDragMove는 그때
              불리지 않음. 그것만 물면 경로 정보 미리보기가 한 프레임 뒤처져 화면
              순서와 어긋남. onDragOver는 over가 바뀌는 시점에 setOver와 같은
              배치로 불리므로 둘 다 같은 핸들러를 씀 */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragCancel={handlePanelDragCancel}
            onDragEnd={handlePanelDragEnd}
            onDragMove={handlePanelDragMove}
            onDragOver={handlePanelDragMove}
            onDragStart={handlePanelDragStart}
          >
            {/* 밀림은 전략이 내는 transform이 아니라 dragOffsets로 그림. 드래그 중 경로 정보
                칸이 생기거나 사라지는 걸 전략은 모르기 때문. 전략은 목록 모양에 맞는
                세로 목록 전략으로 두되, 화면에는 쓰지 않음 */}
            <SortableContext
              items={sortableItems.map((node) => node.pathId)}
              strategy={verticalListSortingStrategy}
            >
              <ul
                role="tree"
                aria-label="여행 일정"
                className="min-h-full outline-none"
                tabIndex={0}
                onClick={(event) => {
                  // 노드 클릭의 bubbling으로 선택이 풀리지 않도록 실제 빈 영역만 처리
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
                {sortableItems.map((node) => {
                  const { boundaryAncestor, hasRouteSlot, previousActivity, showsRouteInfo } =
                    rowAdornments.get(node.pathId)!;
                  const isDraggingList = activePathId !== null;
                  // 목록에서 빠진 잡은 노드는 보일 배치에 없음. 그 행에는 아무것도 그리지 않음
                  const isInVisibleLayout = !dragOffsets || dragOffsets.has(node.pathId);
                  // 평상시 경로 정보에만 씀. 드래그 중에는 선택 강조를 끄고 dragRouteInfo가 그림
                  const routeHighlight =
                    !isDraggingList && previousActivity
                      ? getPlannerRouteHighlight(
                          getPlannerSelectionState(previousActivity, selection, tree.entityMap),
                          getPlannerSelectionState(node, selection, tree.entityMap),
                        )
                      : null;

                  return (
                    <PlannerTreeItem
                      key={node.pathId}
                      node={node}
                      routeInfo={
                        node.kind === "activity" && hasRouteSlot ? (
                          // 레이아웃 높이를 지키는 칸. 드래그 중에는 비워 두고,
                          // 내용은 노드 박스에 붙은 dragRouteInfo가 노드와 함께 옮김
                          <div
                            data-planner-route-slot=""
                            style={{ height: PLANNER_ROUTE_INFO_HEIGHT, overflow: "hidden" }}
                          >
                            {!isDraggingList && previousActivity ? (
                              <PlannerRouteInfo
                                activity={node}
                                previousActivity={previousActivity}
                                indentation={getPlannerRowIndentation(node.depth)}
                                highlight={routeHighlight}
                              />
                            ) : null}
                          </div>
                        ) : null
                      }
                      dragRouteInfo={
                        isDraggingList &&
                        isInVisibleLayout &&
                        showsRouteInfo &&
                        node.kind === "activity" &&
                        previousActivity ? (
                          <PlannerRouteInfo
                            activity={node}
                            previousActivity={previousActivity}
                            indentation={getPlannerRowIndentation(node.depth)}
                          />
                        ) : null
                      }
                      dragOffset={dragOffsets?.get(node.pathId) ?? 0}
                      dayNumber={dayNumberByPathId.get(node.pathId)}
                      boundaryAncestor={boundaryAncestor}
                      isDropTargetVisible={!isOutsideList}
                      isChildTarget={childTargetPathId === node.pathId}
                      isExpandingTarget={expandingTargetPathId === node.pathId}
                      isSortable={isNodeMoveEnabled}
                      suppressSelectionHighlight={activePathId !== null}
                      commands={commandBindings}
                      nameEditing={nameEditing}
                      memoEditing={memoEditing}
                      registerItem={registerItem}
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
