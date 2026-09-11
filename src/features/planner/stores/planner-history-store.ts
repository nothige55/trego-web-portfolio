// undo/redo 스택을 소유. 항목은 스냅샷이 아니라 redo/undo 커맨드 배열 쌍
// 재생이 끝나기 전에는 isReplaying으로 다음 undo/redo를 막음

import { create } from "zustand";

import type { PlannerOperationCommand } from "@/features/planner/operations/planner-operation-command";

export interface PlannerHistoryEntry {
  readonly label: string;
  readonly redo: readonly PlannerOperationCommand[];
  readonly undo: readonly PlannerOperationCommand[];
}

interface PlannerHistoryState {
  readonly past: readonly PlannerHistoryEntry[];
  readonly future: readonly PlannerHistoryEntry[];
  readonly isReplaying: boolean;
}

interface PlannerHistoryActions {
  readonly clear: () => void;
  readonly finishReplay: () => void;
  readonly push: (entry: PlannerHistoryEntry) => void;
  readonly takeRedo: () => PlannerHistoryEntry | null;
  readonly takeUndo: () => PlannerHistoryEntry | null;
}

const initialState: PlannerHistoryState = { past: [], future: [], isReplaying: false };

export const usePlannerHistoryStore = create<PlannerHistoryState & PlannerHistoryActions>(
  (set, get) => ({
    ...initialState,
    clear: () => set(initialState),
    finishReplay: () => set({ isReplaying: false }),
    push: (entry) =>
      set((state) => ({ past: [...state.past, entry], future: [], isReplaying: false })),
    takeUndo: () => {
      const entry = get().past.at(-1);
      if (!entry || get().isReplaying) {
        return null;
      }
      set((state) => ({
        past: state.past.slice(0, -1),
        future: [entry, ...state.future],
        isReplaying: true,
      }));
      return entry;
    },
    takeRedo: () => {
      const entry = get().future[0];
      if (!entry || get().isReplaying) {
        return null;
      }
      set((state) => ({
        past: [...state.past, entry],
        future: state.future.slice(1),
        isReplaying: true,
      }));
      return entry;
    },
  }),
);
