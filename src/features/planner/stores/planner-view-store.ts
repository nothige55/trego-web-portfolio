import { create } from "zustand";

import type {
  PlannerNode,
  PlannerNodePathId,
  PlannerTree,
} from "@/features/planner/types/planner-node";
import { buildPlannerTree } from "@/features/planner/utils/build-planner-tree";
import {
  calculateShiftSelection,
  getShiftSelectionRange,
} from "@/features/planner/utils/calculate-shift-selection";
import { getVisiblePlannerNodes } from "@/features/planner/utils/get-visible-planner-nodes";

export type PlannerModule = "explore" | "chat";

type PlannerViewState = {
  readonly tree: PlannerTree;
  readonly rootPathId: PlannerNodePathId | null;
  readonly expandedIds: ReadonlySet<PlannerNodePathId>;
  readonly selectedItemId: PlannerNodePathId | null;
  readonly selectionRevision: number;
  readonly multiSelectedIds: readonly PlannerNodePathId[];
  readonly selectionRangeIds: readonly PlannerNodePathId[];
  readonly activeModule: PlannerModule;
  readonly isModuleCollapsed: boolean;
};

type PlannerViewActions = {
  load: (nodes: readonly PlannerNode[]) => void;
  reset: () => void;
  toggleExpanded: (pathId: PlannerNodePathId) => void;
  collapseAll: () => void;
  selectItem: (pathId: PlannerNodePathId, extendSelection?: boolean) => void;
  clearSelection: () => void;
  setActiveModule: (module: PlannerModule) => void;
  setModuleCollapsed: (isCollapsed: boolean) => void;
};

type PlannerViewStore = PlannerViewState & PlannerViewActions;

// Map과 Set을 매번 새로 만들어 reset 간에 변경 가능한 컬렉션이 공유되지 않게 한다.
function createEmptyTree(): PlannerTree {
  return {
    entityMap: new Map(),
    childrenMap: new Map(),
    flattenedItems: [],
  };
}

function createInitialState(): PlannerViewState {
  return {
    tree: createEmptyTree(),
    rootPathId: null,
    expandedIds: new Set(),
    selectedItemId: null,
    selectionRevision: 0,
    multiSelectedIds: [],
    selectionRangeIds: [],
    activeModule: "explore",
    isModuleCollapsed: false,
  };
}

export const usePlannerViewStore = create<PlannerViewStore>((set, get) => ({
  ...createInitialState(),
  load(nodes) {
    // 원본 노드는 보관하지 않고 화면 조회에 필요한 세 가지 파생 구조로 즉시 변환한다.
    const tree = buildPlannerTree(nodes);
    const rootNode = tree.flattenedItems.find((node) => node.parentPathId === null) ?? null;

    set({
      tree,
      rootPathId: rootNode?.pathId ?? null,
      expandedIds: new Set(rootNode ? [rootNode.pathId] : []),
      selectedItemId: null,
      selectionRevision: 0,
      multiSelectedIds: [],
      selectionRangeIds: [],
    });
  },
  reset() {
    set(createInitialState());
  },
  toggleExpanded(pathId) {
    set((state) => {
      if ((state.tree.childrenMap.get(pathId) ?? []).length === 0) {
        return state;
      }

      const expandedIds = new Set(state.expandedIds);
      if (expandedIds.has(pathId)) {
        expandedIds.delete(pathId);
      } else {
        expandedIds.add(pathId);

        // 접힌 조상 아래의 노드를 열더라도 대상이 실제로 보이도록 모든 조상도 펼친다.
        let currentNode = state.tree.entityMap.get(pathId);
        while (currentNode?.parentPathId) {
          expandedIds.add(currentNode.parentPathId);
          currentNode = state.tree.entityMap.get(currentNode.parentPathId);
        }
      }

      return { expandedIds };
    });
  },
  collapseAll() {
    const { rootPathId } = get();
    set({ expandedIds: new Set(rootPathId ? [rootPathId] : []) });
  },
  selectItem(pathId, extendSelection = false) {
    const state = get();
    const currentItem = state.tree.entityMap.get(pathId);

    if (!currentItem) {
      return;
    }

    if (!extendSelection || !state.selectedItemId) {
      set({
        selectedItemId: pathId,
        selectionRevision: state.selectionRevision + 1,
        multiSelectedIds: [],
        selectionRangeIds: [],
      });
      return;
    }

    const lastSelectedItem = state.tree.entityMap.get(state.selectedItemId);
    if (!lastSelectedItem) {
      set({
        selectedItemId: pathId,
        selectionRevision: state.selectionRevision + 1,
        multiSelectedIds: [],
        selectionRangeIds: [],
      });
      return;
    }

    const visibleItems = getVisiblePlannerNodes(
      state.tree.flattenedItems,
      state.expandedIds,
      state.tree.childrenMap,
    );
    const selectionRange = getShiftSelectionRange(visibleItems, currentItem, lastSelectedItem);
    const selectedItems = calculateShiftSelection({
      flattenedItems: visibleItems,
      currentItem,
      lastSelectedItem,
      childrenMap: state.tree.childrenMap,
      entityMap: state.tree.entityMap,
    });

    // Shift 선택 중에도 최초 단일 선택은 anchor로 유지해 연속 범위 선택 기준으로 사용한다.
    set({
      multiSelectedIds: selectedItems.map((item) => item.pathId),
      selectionRangeIds: selectionRange.map((item) => item.pathId),
    });
  },
  clearSelection() {
    set({ selectedItemId: null, multiSelectedIds: [], selectionRangeIds: [] });
  },
  setActiveModule(activeModule) {
    // 탭을 직접 선택하면 접혀 있던 패널도 다시 표시하는 기존 UX를 유지한다.
    set({ activeModule, isModuleCollapsed: false });
  },
  setModuleCollapsed(isModuleCollapsed) {
    set({ isModuleCollapsed });
  },
}));
