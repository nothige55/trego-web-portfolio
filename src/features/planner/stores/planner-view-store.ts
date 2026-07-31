import { create } from "zustand";

import { applyPlannerDrop } from "@/features/planner/dnd/apply-planner-drop";
import type { PlannerDropDestination } from "@/features/planner/dnd/planner-drop-rules";
import type {
  PlannerNode,
  PlannerNodePathId,
  PlannerTree,
} from "@/features/planner/types/planner-node";
import type { PlannerProjectDetails } from "@/features/planner/types/planner-project";
import { buildPlannerTree } from "@/features/planner/utils/build-planner-tree";
import {
  calculateShiftSelection,
  getShiftSelectionRange,
} from "@/features/planner/utils/calculate-shift-selection";
import { getVisiblePlannerNodes } from "@/features/planner/utils/get-visible-planner-nodes";

export type PlannerModule = "explore" | "chat";

type PlannerViewState = {
  readonly nodes: readonly PlannerNode[];
  readonly projectDetails: PlannerProjectDetails | null;
  readonly tree: PlannerTree;
  readonly rootPathId: PlannerNodePathId | null;
  readonly expandedIds: ReadonlySet<PlannerNodePathId>;
  readonly selectedItemId: PlannerNodePathId | null;
  readonly mapFocusRequest: Readonly<{ pathId: PlannerNodePathId }> | null;
  readonly multiSelectedIds: readonly PlannerNodePathId[];
  readonly selectionRangeIds: readonly PlannerNodePathId[];
  readonly activeModule: PlannerModule;
  readonly isModuleCollapsed: boolean;
};

type PlannerViewActions = {
  load: (nodes: readonly PlannerNode[]) => void;
  replaceNodes: (nodes: readonly PlannerNode[]) => void;
  setProjectDetails: (projectDetails: PlannerProjectDetails) => void;
  reset: () => void;
  toggleExpanded: (pathId: PlannerNodePathId) => void;
  expandNode: (pathId: PlannerNodePathId) => void;
  collapseAll: () => void;
  moveNode: (pathId: PlannerNodePathId, destination: Readonly<PlannerDropDestination>) => void;
  activateItem: (pathId: PlannerNodePathId) => void;
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
    nodes: [],
    projectDetails: null,
    tree: createEmptyTree(),
    rootPathId: null,
    expandedIds: new Set(),
    selectedItemId: null,
    mapFocusRequest: null,
    multiSelectedIds: [],
    selectionRangeIds: [],
    activeModule: "explore",
    isModuleCollapsed: false,
  };
}

export const usePlannerViewStore = create<PlannerViewStore>((set, get) => ({
  ...createInitialState(),
  load(nodes) {
    // 정규화된 원본 노드와 화면 조회에 필요한 세 가지 파생 구조를 함께 갱신한다.
    const tree = buildPlannerTree(nodes);
    const rootNode = tree.flattenedItems.find((node) => node.parentPathId === null) ?? null;

    set({
      nodes: [...nodes],
      tree,
      rootPathId: rootNode?.pathId ?? null,
      expandedIds: new Set(rootNode ? [rootNode.pathId] : []),
      selectedItemId: null,
      mapFocusRequest: null,
      multiSelectedIds: [],
      selectionRangeIds: [],
    });
  },
  replaceNodes(nodes) {
    set((state) => {
      const tree = buildPlannerTree(nodes);
      const rootNode = tree.flattenedItems.find((node) => node.parentPathId === null) ?? null;
      const expandedIds = new Set(
        [...state.expandedIds].filter((pathId) => tree.entityMap.has(pathId)),
      );

      if (rootNode) {
        expandedIds.add(rootNode.pathId);
      }

      return {
        nodes: [...nodes],
        tree,
        rootPathId: rootNode?.pathId ?? null,
        expandedIds,
        selectedItemId:
          state.selectedItemId && tree.entityMap.has(state.selectedItemId)
            ? state.selectedItemId
            : null,
        multiSelectedIds: state.multiSelectedIds.filter((pathId) => tree.entityMap.has(pathId)),
        selectionRangeIds: state.selectionRangeIds.filter((pathId) => tree.entityMap.has(pathId)),
      };
    });
  },
  setProjectDetails(projectDetails) {
    set({ projectDetails });
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
  expandNode(pathId) {
    set((state) => {
      if (
        state.expandedIds.has(pathId) ||
        (state.tree.childrenMap.get(pathId) ?? []).length === 0
      ) {
        return state;
      }

      const expandedIds = new Set(state.expandedIds);
      let currentNode = state.tree.entityMap.get(pathId);

      while (currentNode) {
        expandedIds.add(currentNode.pathId);
        currentNode = currentNode.parentPathId
          ? state.tree.entityMap.get(currentNode.parentPathId)
          : undefined;
      }

      return { expandedIds };
    });
  },
  collapseAll() {
    const { rootPathId } = get();
    set({ expandedIds: new Set(rootPathId ? [rootPathId] : []) });
  },
  moveNode(pathId, destination) {
    set((state) => ({
      tree: applyPlannerDrop(state.tree, pathId, destination),
      selectedItemId: pathId,
      mapFocusRequest: null,
      multiSelectedIds: [],
      selectionRangeIds: [],
    }));
  },
  activateItem(pathId) {
    const currentItem = get().tree.entityMap.get(pathId);
    if (!currentItem) {
      return;
    }

    // 같은 노드를 다시 눌러도 새 요청 객체를 만들어 지도 포커스를 다시 실행한다.
    set({
      selectedItemId: pathId,
      mapFocusRequest: { pathId },
      multiSelectedIds: [],
      selectionRangeIds: [],
    });
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
        mapFocusRequest: null,
        multiSelectedIds: [],
        selectionRangeIds: [],
      });
      return;
    }

    const lastSelectedItem = state.tree.entityMap.get(state.selectedItemId);
    if (!lastSelectedItem) {
      set({
        selectedItemId: pathId,
        mapFocusRequest: null,
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
      mapFocusRequest: null,
      multiSelectedIds: selectedItems.map((item) => item.pathId),
      selectionRangeIds: selectionRange.map((item) => item.pathId),
    });
  },
  clearSelection() {
    set({
      selectedItemId: null,
      mapFocusRequest: null,
      multiSelectedIds: [],
      selectionRangeIds: [],
    });
  },
  setActiveModule(activeModule) {
    // 탭을 직접 선택하면 접혀 있던 패널도 다시 표시하는 기존 UX를 유지한다.
    set({ activeModule, isModuleCollapsed: false });
  },
  setModuleCollapsed(isModuleCollapsed) {
    set({ isModuleCollapsed });
  },
}));
