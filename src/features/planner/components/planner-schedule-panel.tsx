import { ChevronDown, ChevronRight, ListChevronsDownUp } from "lucide-react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { DayMapVisibilityToggle } from "@/features/planner/components/day-map-visibility-toggle";
import {
  PLANNER_BREADCRUMB_HEIGHT,
  PlannerBreadcrumb,
} from "@/features/planner/components/planner-breadcrumb";
import { PlannerNodeLabel } from "@/features/planner/components/planner-node-label";
import { demoPlannerProject } from "@/features/planner/data/demo-planner";
import { usePlannerViewStore } from "@/features/planner/stores/planner-view-store";
import type {
  FlattenedPlannerNode,
  PlannerNodePathId,
} from "@/features/planner/types/planner-node";
import { getPlannerBreadcrumbAncestors } from "@/features/planner/utils/get-planner-breadcrumb-ancestors";
import { getVisiblePlannerNodes } from "@/features/planner/utils/get-visible-planner-nodes";

// 이 파일은 일정 트리의 표시와 사용자 입력만 담당한다.
// 트리 생성, visible item 계산, 계층 선택 규칙은 각각 store와 순수 함수에 둔다.
const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  month: "2-digit",
  day: "2-digit",
});

function formatDateRange(startDate: string, endDate: string): string {
  return `${dateFormatter.format(new Date(startDate))} – ${dateFormatter.format(new Date(endDate))}`;
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
}: {
  readonly node: FlattenedPlannerNode;
  readonly dayNumber?: number;
  readonly itemRef: (element: HTMLLIElement | null) => void;
  readonly boundaryAncestor?: FlattenedPlannerNode;
}) {
  const entityMap = usePlannerViewStore((state) => state.tree.entityMap);
  const childrenMap = usePlannerViewStore((state) => state.tree.childrenMap);
  const expandedIds = usePlannerViewStore((state) => state.expandedIds);
  const selectedItemId = usePlannerViewStore((state) => state.selectedItemId);
  const multiSelectedIds = usePlannerViewStore((state) => state.multiSelectedIds);
  const selectionRangeIds = usePlannerViewStore((state) => state.selectionRangeIds);
  const toggleExpanded = usePlannerViewStore((state) => state.toggleExpanded);
  const selectItem = usePlannerViewStore((state) => state.selectItem);
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
  // 기존 Planner와 같이 root 다음 계층부터 30px 단위로 들여쓴다.
  // 별도의 20px 토글 칸을 항상 유지해 자식 유무와 관계없이 라벨 시작점을 맞춘다.
  const indentation = Math.max(0, node.depth - 1) * 30;

  return (
    <li
      ref={itemRef}
      role="treeitem"
      aria-expanded={hasChildren ? isExpanded : undefined}
      aria-selected={isSelected}
      data-selection-state={isSelected ? "selected" : isSelectionContext ? "range" : undefined}
      className="relative list-none"
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
      <div
        className={`group flex min-h-9 items-center border-l-2 transition-colors ${
          isSelected
            ? "border-brand bg-brand/10 text-foreground"
            : isSelectionContext
              ? "border-transparent bg-brand/5 text-foreground hover:bg-brand/10"
              : "border-transparent text-foreground hover:bg-muted/70"
        }`}
        style={{ paddingLeft: indentation }}
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
          onClick={(event) => {
            // Shift 여부만 store에 전달하고 선택 범위 계산은 UI 밖에서 처리한다.
            selectItem(node.pathId, event.shiftKey);
          }}
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
      </div>
    </li>
  );
}

export function PlannerSchedulePanel() {
  const tree = usePlannerViewStore((state) => state.tree);
  const rootPathId = usePlannerViewStore((state) => state.rootPathId);
  const expandedIds = usePlannerViewStore((state) => state.expandedIds);
  const collapseAll = usePlannerViewStore((state) => state.collapseAll);
  const clearSelection = usePlannerViewStore((state) => state.clearSelection);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<PlannerNodePathId, HTMLLIElement>());
  const [topItemId, setTopItemId] = useState<PlannerNodePathId | null>(null);
  const visibleItems = useMemo(
    () => getVisiblePlannerNodes(tree.flattenedItems, expandedIds, tree.childrenMap),
    [expandedIds, tree.childrenMap, tree.flattenedItems],
  );
  const dayNumberByPathId = useMemo(() => {
    const startDate = new Date(`${demoPlannerProject.startDate}T00:00:00Z`);
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
  }, [tree.flattenedItems]);
  // root는 프로젝트 컨테이너이므로 탐색 순서에는 사용하되 목록에서는 숨긴다.
  const renderedItems = useMemo(
    () => visibleItems.filter((item) => item.pathId !== rootPathId),
    [rootPathId, visibleItems],
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

  return (
    <aside
      aria-label="일정 패널"
      className="z-20 flex h-full w-80 shrink-0 flex-col border-r bg-card text-card-foreground"
    >
      <header className="border-b px-6 py-4">
        <p className="text-xs font-semibold tracking-wide text-brand">Trego Planner</p>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{demoPlannerProject.title}</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              여행 메모와 태그 기능을 준비 중입니다.
            </p>
          </div>
          <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground tabular-nums">
            {formatDateRange(demoPlannerProject.startDate, demoPlannerProject.endDate)}
          </span>
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-x-0 top-0 z-50 flex h-8 items-center justify-between bg-card px-6 pr-2 text-sm font-medium">
          <span>일정</span>
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
              if (event.key === "Escape") {
                clearSelection();
              }
            }}
          >
            {renderedItems.map((node, index) => {
              const nextItem = renderedItems[index + 1];
              const boundaryAncestor =
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
        </div>
      </div>
    </aside>
  );
}
