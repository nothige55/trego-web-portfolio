// 프로젝트 초기 데이터(일정 + 채팅 기록)의 적재와 재조회를 함께 소유
// 두 요청은 재동기화 때 항상 같이 실행되고 "지금 열려 있는 프로젝트인가" 판정을 공유하므로 한 hook에 둠

import { useCallback, useEffect, useRef, useState } from "react";

import {
  type ChatMessage,
  mergeChatMessages,
  replaceChatMessagesFromHistory,
} from "@/features/chat";
import { getChatMessages } from "@/features/chat/api/chat-api";
import { getProjectDetails, getProjectNodes } from "@/features/planner/api/project-api";
import { usePlannerHistoryStore } from "@/features/planner/stores/planner-history-store";
import { usePlannerMapStore } from "@/features/planner/stores/planner-map-store";
import { usePlannerViewStore } from "@/features/planner/stores/planner-view-store";
import type { ApiClient } from "@/lib/api-client";

// status는 "화면에 보여 줄 일정이 store에 있는가"를, error는 마지막 조회의 실패 원인을 나타냄
// - loading: 이 프로젝트의 일정을 아직 받지 못함
// - error: 첫 조회가 실패해 보여 줄 일정이 없음
// - ready: 일정이 적재되어 있음. 재조회가 실패해도 ready를 유지하고 error만 채움
export type ProjectDataState = {
  readonly error: Error | null;
  readonly projectId: string;
  readonly status: "error" | "loading" | "ready";
};

type ProjectDataLoadMode = "initial" | "refresh";

function createLoadingState(projectId: string): ProjectDataState {
  return { error: null, projectId, status: "loading" };
}

function isReadyFor(state: ProjectDataState, projectId: string): boolean {
  return state.projectId === projectId && state.status === "ready";
}

export type ProjectDataLoader = {
  readonly appendChatMessage: (message: ChatMessage) => void;
  readonly chatHistoryStatus: "error" | "loading" | "ready";
  readonly loadChatHistory: () => Promise<void>;
  readonly messages: readonly ChatMessage[];
  readonly projectDataState: ProjectDataState;
  readonly reload: () => Promise<void>;
};

export function useProjectDataLoader({
  projectId,
  restClient,
}: {
  readonly projectId: string;
  readonly restClient: ApiClient;
}): ProjectDataLoader {
  const [messageState, setMessageState] = useState<{
    readonly messages: readonly ChatMessage[];
    readonly projectId: string;
  }>({ messages: [], projectId });
  const [chatHistoryStatus, setChatHistoryStatus] = useState<"error" | "loading" | "ready">(
    "loading",
  );
  const [projectDataState, setProjectDataState] = useState<ProjectDataState>(() =>
    createLoadingState(projectId),
  );
  const activeProjectIdRef = useRef<string | null>(projectId);
  const projectRequestIdRef = useRef(0);
  const projectDataRequestRef = useRef<{ projectId: string; promise: Promise<void> } | null>(null);
  const historyRequestRef = useRef<{ projectId: string; promise: Promise<void> } | null>(null);

  const loadChatHistory = useCallback((): Promise<void> => {
    const pendingRequest = historyRequestRef.current;

    if (pendingRequest?.projectId === projectId) {
      return pendingRequest.promise;
    }

    setChatHistoryStatus("loading");
    const promise = getChatMessages(projectId, restClient)
      .then((history) => {
        setMessageState((current) => ({
          messages: mergeChatMessages(
            replaceChatMessagesFromHistory(history),
            current.projectId === projectId ? current.messages : [],
          ),
          projectId,
        }));

        if (activeProjectIdRef.current === projectId) {
          setChatHistoryStatus("ready");
        }
      })
      .catch((error: unknown) => {
        if (activeProjectIdRef.current === projectId) {
          setChatHistoryStatus("error");
        }
        throw error;
      })
      .finally(() => {
        if (historyRequestRef.current?.promise === promise) {
          historyRequestRef.current = null;
        }
      });

    historyRequestRef.current = { projectId, promise };
    return promise;
  }, [projectId, restClient]);

  // 재조회(refresh)는 이미 떠 있는 일정을 그대로 두고, 응답이 오면 노드만 교체
  // loading으로 되돌리면 호출부가 fallback 화면으로 바꾸면서 PlannerWorkspace가 unmount되어
  // 트리 스크롤 위치와 지도 인스턴스를 잃음. initial은 store를 비운 직후라 항상 loading부터 시작
  const loadProjectData = useCallback(
    (mode: ProjectDataLoadMode): Promise<void> => {
      const pendingRequest = projectDataRequestRef.current;

      if (pendingRequest?.projectId === projectId) {
        return pendingRequest.promise;
      }

      const requestId = ++projectRequestIdRef.current;
      setProjectDataState((current) =>
        mode === "refresh" && isReadyFor(current, projectId)
          ? current
          : createLoadingState(projectId),
      );
      const promise = Promise.all([
        getProjectDetails(projectId, restClient),
        getProjectNodes(projectId, restClient),
      ])
        .then(([projectDetails, nodes]) => {
          if (
            activeProjectIdRef.current !== projectId ||
            projectRequestIdRef.current !== requestId
          ) {
            return;
          }

          const plannerStore = usePlannerViewStore.getState();
          plannerStore.setProjectDetails(projectDetails);
          plannerStore.replaceNodes(nodes);
          setProjectDataState({ error: null, projectId, status: "ready" });
        })
        .catch((error: unknown) => {
          const projectError = error instanceof Error ? error : new Error(String(error));

          if (
            activeProjectIdRef.current === projectId &&
            projectRequestIdRef.current === requestId
          ) {
            // 보여 줄 일정이 이미 있으면 화면을 유지하고 원인만 기록
            // 사용자에게는 호출부가 받는 rejection(featureError·실시간 연결 배너)으로 드러남
            setProjectDataState((current) =>
              isReadyFor(current, projectId)
                ? { ...current, error: projectError }
                : { error: projectError, projectId, status: "error" },
            );
          }

          throw projectError;
        })
        .finally(() => {
          if (projectDataRequestRef.current?.promise === promise) {
            projectDataRequestRef.current = null;
          }
        });

      projectDataRequestRef.current = { projectId, promise };
      return promise;
    },
    [projectId, restClient],
  );

  useEffect(() => {
    activeProjectIdRef.current = projectId;
    projectRequestIdRef.current += 1;
    usePlannerViewStore.getState().reset();
    usePlannerMapStore.getState().reset();
    usePlannerHistoryStore.getState().clear();
    void loadProjectData("initial").catch(() => undefined);
    void loadChatHistory().catch(() => undefined);

    return () => {
      if (activeProjectIdRef.current === projectId) {
        activeProjectIdRef.current = null;
        projectRequestIdRef.current += 1;
        projectDataRequestRef.current = null;
        historyRequestRef.current = null;
        usePlannerViewStore.getState().reset();
        usePlannerMapStore.getState().reset();
        usePlannerHistoryStore.getState().clear();
      }
    };
  }, [loadChatHistory, loadProjectData, projectId]);

  const reload = useCallback(async (): Promise<void> => {
    await Promise.all([loadProjectData("refresh"), loadChatHistory()]);
  }, [loadChatHistory, loadProjectData]);

  const appendChatMessage = useCallback(
    (message: ChatMessage): void => {
      if (message.projectId !== projectId) {
        return;
      }

      setMessageState((current) => ({
        messages: mergeChatMessages(current.projectId === projectId ? current.messages : [], [
          message,
        ]),
        projectId,
      }));
    },
    [projectId],
  );

  return {
    appendChatMessage,
    chatHistoryStatus,
    loadChatHistory,
    messages: messageState.projectId === projectId ? messageState.messages : [],
    projectDataState:
      projectDataState.projectId === projectId ? projectDataState : createLoadingState(projectId),
    reload,
  };
}
