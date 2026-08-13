import { addDays, format, parseISO } from "date-fns";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useProjectRealtime } from "@/app/realtime/project-realtime-context";
import {
  ProjectRealtimeProvider,
  ProjectRealtimeStatusBanner,
} from "@/app/realtime/project-realtime-provider";
import type { AuthSession } from "@/features/auth/types";
import {
  type ChatMessage,
  createSendChatMessageCommand,
  mergeChatMessages,
  replaceChatMessagesFromHistory,
  type SendChatMessageResult,
  subscribeToChatMessages,
} from "@/features/chat";
import { getChatMessages } from "@/features/chat/api/chat-api";
import { RealtimeChatPanel } from "@/features/chat/components/realtime-chat-panel";
import { CursorPresenceLayer } from "@/features/collaboration/components/cursor-presence-layer";
import {
  createCursorPresenceController,
  type CursorPresenceController,
} from "@/features/collaboration/realtime/cursor-presence-controller";
import { getProjectDetails, getProjectNodes } from "@/features/planner/api/project-api";
import type {
  PlannerNodeEditingCommands,
  PlannerNodeMoveHandler,
} from "@/features/planner/components/planner-schedule-panel";
import { PlannerWorkspace } from "@/features/planner/components/planner-workspace";
import {
  buildPlannerDateRangeHistory,
  buildPlannerDeleteHistory,
  type PlannerDateRangeInput,
} from "@/features/planner/operations/planner-date-range";
import {
  executePlannerOperationCommands,
  type PlannerOperationCommand,
} from "@/features/planner/operations/planner-operation-command";
import {
  buildCreateNodeInput,
  buildGroupPlan,
  normalizeOperationPathIds,
} from "@/features/planner/operations/planner-operations";
import {
  createPlannerRealtime,
  type PlannerRealtimeCommands,
} from "@/features/planner/realtime/planner-realtime";
import type { UpdatePathInput } from "@/features/planner/realtime/project-hub-planner-contracts";
import { usePlannerHistoryStore } from "@/features/planner/stores/planner-history-store";
import { usePlannerMapStore } from "@/features/planner/stores/planner-map-store";
import { usePlannerViewStore } from "@/features/planner/stores/planner-view-store";
import { ProjectMemberInviteForm } from "@/features/project-management/components/project-member-invite-form";
import type { ApiClient } from "@/lib/api-client";
import { createApiClient } from "@/lib/api-client";
import type { SignalRClient, SignalRClientOptions } from "@/lib/signalr-client";

type ProjectPlannerPageProps = {
  readonly clientFactory?: (options: SignalRClientOptions) => SignalRClient;
  readonly identity: AuthSession;
  readonly projectId: string;
  readonly restClient?: ApiClient;
};

type ProjectDataState = {
  readonly error: Error | null;
  readonly projectId: string;
  readonly status: "error" | "loading" | "ready";
};

export function ProjectPlannerPage({
  clientFactory,
  identity,
  projectId,
  restClient: injectedRestClient,
}: ProjectPlannerPageProps) {
  const [messageState, setMessageState] = useState<{
    readonly messages: readonly ChatMessage[];
    readonly projectId: string;
  }>({ messages: [], projectId });
  const [chatHistoryStatus, setChatHistoryStatus] = useState<"error" | "loading" | "ready">(
    "loading",
  );
  const [presenceController, setPresenceController] = useState<CursorPresenceController | null>(
    null,
  );
  const [featureError, setFeatureError] = useState<Error | null>(null);
  const [projectDataState, setProjectDataState] = useState<ProjectDataState>({
    error: null,
    projectId,
    status: "loading",
  });
  const activeProjectIdRef = useRef<string | null>(projectId);
  const projectRequestIdRef = useRef(0);
  const projectDataRequestRef = useRef<{ projectId: string; promise: Promise<void> } | null>(null);
  const historyRequestRef = useRef<{ projectId: string; promise: Promise<void> } | null>(null);
  const plannerCommandsRef = useRef<PlannerRealtimeCommands | null>(null);
  const messages = messageState.projectId === projectId ? messageState.messages : [];
  const authorizedRestClient = useMemo(
    () =>
      injectedRestClient ??
      createApiClient({
        getAccessToken: () => identity.accessToken,
      }),
    [identity.accessToken, injectedRestClient],
  );

  const loadChatHistory = useCallback((): Promise<void> => {
    const pendingRequest = historyRequestRef.current;

    if (pendingRequest?.projectId === projectId) {
      return pendingRequest.promise;
    }

    setChatHistoryStatus("loading");
    const promise = getChatMessages(projectId, authorizedRestClient)
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
  }, [authorizedRestClient, projectId]);

  const loadProjectData = useCallback((): Promise<void> => {
    const pendingRequest = projectDataRequestRef.current;

    if (pendingRequest?.projectId === projectId) {
      return pendingRequest.promise;
    }

    const requestId = ++projectRequestIdRef.current;
    setProjectDataState({ error: null, projectId, status: "loading" });
    const promise = Promise.all([
      getProjectDetails(projectId, authorizedRestClient),
      getProjectNodes(projectId, authorizedRestClient),
    ])
      .then(([projectDetails, nodes]) => {
        if (activeProjectIdRef.current !== projectId || projectRequestIdRef.current !== requestId) {
          return;
        }

        const plannerStore = usePlannerViewStore.getState();
        plannerStore.setProjectDetails(projectDetails);
        plannerStore.replaceNodes(nodes);
        setProjectDataState({ error: null, projectId, status: "ready" });
      })
      .catch((error: unknown) => {
        const projectError = error instanceof Error ? error : new Error(String(error));

        if (activeProjectIdRef.current === projectId && projectRequestIdRef.current === requestId) {
          setProjectDataState({ error: projectError, projectId, status: "error" });
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
  }, [authorizedRestClient, projectId]);

  useEffect(() => {
    activeProjectIdRef.current = projectId;
    projectRequestIdRef.current += 1;
    usePlannerViewStore.getState().reset();
    usePlannerMapStore.getState().reset();
    usePlannerHistoryStore.getState().clear();
    void loadProjectData().catch(() => undefined);
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

  const resync = useCallback(async () => {
    await Promise.all([loadProjectData(), loadChatHistory()]);
    usePlannerHistoryStore.getState().clear();
    setFeatureError(null);
  }, [loadChatHistory, loadProjectData]);

  const registerSubscriptions = useCallback(
    (client: SignalRClient) => {
      const plannerRealtime = createPlannerRealtime(client, {
        getNodes: () => usePlannerViewStore.getState().nodes,
        setNodes: (nodes) => usePlannerViewStore.getState().replaceNodes(nodes),
        applyProjectUpdate: (update) => usePlannerViewStore.getState().setProjectDetails(update),
        reportError: (error) =>
          setFeatureError(error instanceof Error ? error : new Error(String(error))),
        resync,
      });
      plannerCommandsRef.current = plannerRealtime.commands;
      const unsubscribePlanner = plannerRealtime.subscribe();
      const unsubscribeChat = subscribeToChatMessages(client, {
        onMessageReceived: (message) => {
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
      });
      const controller = createCursorPresenceController({
        client,
        projectId,
        userId: identity.id,
      });
      setPresenceController(controller);

      return () => {
        if (plannerCommandsRef.current === plannerRealtime.commands) {
          plannerCommandsRef.current = null;
        }
        unsubscribePlanner();
        unsubscribeChat();
        controller.dispose();
      };
    },
    [identity.id, projectId, resync],
  );

  const invokePlannerCommand = useCallback(
    async (invoke: (commands: PlannerRealtimeCommands) => Promise<void>): Promise<void> => {
      const commands = plannerCommandsRef.current;

      if (!commands) {
        const error = new Error("Planner 실시간 명령을 사용할 수 없습니다.");
        setFeatureError(error);
        throw error;
      }

      setFeatureError(null);

      try {
        await invoke(commands);
      } catch (error) {
        // adapter의 canonical resync가 끝난 뒤에도 사용자가 실패 원인을 확인할 수 있게 남긴다.
        setFeatureError(error instanceof Error ? error : new Error(String(error)));
        throw error;
      }
    },
    [],
  );
  const runRecordedOperation = useCallback(
    async (
      label: string,
      redo: readonly PlannerOperationCommand[],
      undo: readonly PlannerOperationCommand[],
    ): Promise<void> => {
      try {
        await invokePlannerCommand((commands) => executePlannerOperationCommands(commands, redo));
        usePlannerHistoryStore.getState().push({ label, redo, undo });
      } catch (error) {
        usePlannerHistoryStore.getState().clear();
        throw error;
      }
    },
    [invokePlannerCommand],
  );
  const replayHistory = useCallback(
    async (direction: "redo" | "undo"): Promise<void> => {
      const history = usePlannerHistoryStore.getState();
      const entry = direction === "undo" ? history.takeUndo() : history.takeRedo();
      if (!entry) return;

      try {
        await invokePlannerCommand((commands) =>
          executePlannerOperationCommands(commands, entry[direction]),
        );
        usePlannerHistoryStore.getState().finishReplay();
      } catch (error) {
        usePlannerHistoryStore.getState().clear();
        throw error;
      }
    },
    [invokePlannerCommand],
  );
  const updatePlannerPath = useCallback(
    (input: UpdatePathInput, previousInput: UpdatePathInput): Promise<void> =>
      runRecordedOperation(
        "일정 이동",
        [{ type: "update-path", input }],
        [{ type: "update-path", input: previousInput }],
      ),
    [runRecordedOperation],
  );
  const updatePlannerDateRange = useCallback(
    async (input: PlannerDateRangeInput): Promise<void> => {
      const state = usePlannerViewStore.getState();
      if (!state.projectDetails || !state.rootPathId) {
        throw new Error("여행 날짜 정보를 불러오지 못했습니다.");
      }

      const history = buildPlannerDateRangeHistory({
        input,
        nodes: state.nodes,
        orderedPathIds: state.tree.flattenedItems.map((node) => node.pathId),
        projectDetails: state.projectDetails,
        rootPathId: state.rootPathId,
      });
      await runRecordedOperation("여행 날짜 변경", history.redo, history.undo);
    },
    [runRecordedOperation],
  );
  const plannerNodeEditingCommands = useMemo<PlannerNodeEditingCommands>(
    () => ({
      createNode: async (draft) => {
        const created = buildCreateNodeInput(usePlannerViewStore.getState().nodes, draft);
        const createOperation: PlannerOperationCommand = {
          type: created.kind === "day" ? "create-day" : "create-folder",
          input: created.input,
        } as PlannerOperationCommand;
        await runRecordedOperation(
          "일정 추가",
          [createOperation],
          [{ type: "delete-node", input: { pathId: created.input.pathId } }],
        );
      },
      deleteNode: async (input) => {
        const state = usePlannerViewStore.getState();
        if (!state.projectDetails) throw new Error("여행 날짜 정보를 불러오지 못했습니다.");
        const history = buildPlannerDeleteHistory({
          nodes: state.nodes,
          pathIds: [input.pathId],
          projectDetails: state.projectDetails,
        });
        await runRecordedOperation("일정 삭제", history.redo, history.undo);
      },
      deleteNodes: async (pathIds) => {
        const state = usePlannerViewStore.getState();
        if (!state.projectDetails) throw new Error("여행 날짜 정보를 불러오지 못했습니다.");
        const normalizedPathIds = normalizeOperationPathIds(state.nodes, pathIds);
        const history = buildPlannerDeleteHistory({
          nodes: state.nodes,
          pathIds: normalizedPathIds,
          projectDetails: state.projectDetails,
        });
        await runRecordedOperation("선택 일정 삭제", history.redo, history.undo);
      },
      extendDateRange: async () => {
        const projectDetails = usePlannerViewStore.getState().projectDetails;
        if (!projectDetails) throw new Error("여행 날짜 정보를 불러오지 못했습니다.");
        await updatePlannerDateRange({
          startDate: projectDetails.startDate.slice(0, 10),
          endDate: format(addDays(parseISO(projectDetails.endDate), 1), "yyyy-MM-dd"),
        });
      },
      groupNodes: async (pathIds) => {
        const nodes = usePlannerViewStore.getState().nodes;
        const plan = buildGroupPlan(nodes, pathIds);
        const containerOperation: PlannerOperationCommand = {
          type: plan.container.kind === "activity" ? "create-activity" : "create-folder",
          input: plan.container.input,
        } as PlannerOperationCommand;
        const originals = plan.moves.map((move) => {
          const node = nodes.find((candidate) => candidate.pathId === move.pathId)!;
          return {
            type: "update-path" as const,
            input: {
              pathId: node.pathId,
              parentPathId: node.parentPathId,
              position: node.position,
            },
          };
        });
        await runRecordedOperation(
          "선택 일정 그룹화",
          [
            containerOperation,
            ...plan.moves.map((input) => ({ type: "update-path" as const, input })),
          ],
          [...originals, { type: "delete-node", input: { pathId: plan.container.input.pathId } }],
        );
      },
      redo: () => replayHistory("redo"),
      undo: () => replayHistory("undo"),
      updateActivity: async (input) => {
        const node = usePlannerViewStore
          .getState()
          .nodes.find((candidate) => candidate.kind === "activity" && candidate.id === input.id);
        if (!node || node.kind !== "activity") throw new Error("Activity를 찾을 수 없습니다.");
        await runRecordedOperation(
          "Activity 메모 수정",
          [{ type: "update-activity", input }],
          [
            {
              type: "update-activity",
              input: {
                id: node.id,
                name: node.name,
                memo: node.memo,
                startTime: node.startTime,
                endTime: node.endTime,
                markerType: node.markerType,
                travelMode: node.travelMode,
                travelTime: node.travelTime,
                travelDistance: node.travelDistance,
                travelCost: node.travelCost,
              },
            },
          ],
        );
      },
      updateDay: async (input) => {
        const node = usePlannerViewStore
          .getState()
          .nodes.find((candidate) => candidate.kind === "day" && candidate.id === input.id);
        if (!node || node.kind !== "day") throw new Error("Day를 찾을 수 없습니다.");
        await runRecordedOperation(
          "Day 수정",
          [{ type: "update-day", input }],
          [
            {
              type: "update-day",
              input: { id: node.id, name: node.name, color: node.color ?? "#F44336" },
            },
          ],
        );
      },
      updateFolder: async (input) => {
        const node = usePlannerViewStore
          .getState()
          .nodes.find((candidate) => candidate.kind === "folder" && candidate.id === input.id);
        if (!node || node.kind !== "folder") throw new Error("폴더를 찾을 수 없습니다.");
        await runRecordedOperation(
          "폴더 수정",
          [{ type: "update-folder", input }],
          [
            {
              type: "update-folder",
              input: {
                id: node.id,
                name: node.name,
                folderType: node.folderType ?? "default",
              },
            },
          ],
        );
      },
      updateDateRange: updatePlannerDateRange,
    }),
    [replayHistory, runRecordedOperation, updatePlannerDateRange],
  );

  return (
    <ProjectRealtimeProvider
      accessTokenFactory={() => identity.accessToken}
      clientFactory={clientFactory}
      onError={setFeatureError}
      projectId={projectId}
      registerSubscriptions={registerSubscriptions}
      resync={resync}
    >
      <ProjectPlannerPageContent
        featureError={featureError}
        chatHistoryStatus={chatHistoryStatus}
        identity={identity}
        loadChatHistory={loadChatHistory}
        messages={messages}
        plannerNodeEditingCommands={plannerNodeEditingCommands}
        presenceController={presenceController}
        projectDataState={
          projectDataState.projectId === projectId
            ? projectDataState
            : { error: null, projectId, status: "loading" }
        }
        projectId={projectId}
        restClient={authorizedRestClient}
        updatePlannerPath={updatePlannerPath}
      />
    </ProjectRealtimeProvider>
  );
}

type ProjectPlannerPageContentProps = {
  readonly chatHistoryStatus: "error" | "loading" | "ready";
  readonly featureError: Error | null;
  readonly identity: AuthSession;
  readonly loadChatHistory: () => Promise<void>;
  readonly messages: readonly ChatMessage[];
  readonly plannerNodeEditingCommands: PlannerNodeEditingCommands;
  readonly presenceController: CursorPresenceController | null;
  readonly projectDataState: ProjectDataState;
  readonly projectId: string;
  readonly restClient: ApiClient;
  readonly updatePlannerPath: (
    input: UpdatePathInput,
    previousInput: UpdatePathInput,
  ) => Promise<void>;
};

function ProjectPlannerPageContent({
  chatHistoryStatus,
  featureError,
  identity,
  loadChatHistory,
  messages,
  plannerNodeEditingCommands,
  presenceController,
  projectDataState,
  projectId,
  restClient,
  updatePlannerPath,
}: ProjectPlannerPageContentProps) {
  const { client, error: sessionError, isReady } = useProjectRealtime();
  const [isNodeMovePending, setIsNodeMovePending] = useState(false);
  const nodeMovePromiseRef = useRef<Promise<void> | null>(null);
  const sendMessage = useMemo(() => createSendChatMessageCommand(client), [client]);
  const handleSend = useCallback(
    (content: string): Promise<SendChatMessageResult> =>
      sendMessage({ content, memberId: identity.id, projectId }),
    [identity.id, projectId, sendMessage],
  );
  const handleMoveNode = useCallback<PlannerNodeMoveHandler>(
    (pathId, destination) => {
      if (!isReady || nodeMovePromiseRef.current) {
        return;
      }

      const currentNode = usePlannerViewStore.getState().tree.entityMap.get(pathId);
      if (!currentNode) return;
      const previousInput = {
        pathId,
        parentPathId: currentNode.parentPathId,
        position: currentNode.position,
      };
      usePlannerViewStore.getState().moveNode(pathId, destination);
      const movePromise = updatePlannerPath(
        {
          pathId,
          parentPathId: destination.parentPathId,
          position: destination.position,
        },
        previousInput,
      );
      nodeMovePromiseRef.current = movePromise;
      setIsNodeMovePending(true);

      void movePromise
        .catch(() => undefined)
        .finally(() => {
          if (nodeMovePromiseRef.current === movePromise) {
            nodeMovePromiseRef.current = null;
            setIsNodeMovePending(false);
          }
        });
    },
    [isReady, updatePlannerPath],
  );

  if (projectDataState.status !== "ready") {
    const error = projectDataState.error ?? sessionError;

    return (
      <main className="flex min-h-svh items-center justify-center bg-[#f6f6f7] p-6">
        <section className="w-full max-w-md rounded-2xl border bg-card p-6 text-center shadow-sm">
          {error ? (
            <>
              <h1 className="text-lg font-semibold">여행 일정을 불러오지 못했습니다.</h1>
              <p role="alert" className="mt-2 text-sm text-destructive">
                {error.message}
              </p>
              <div className="mt-4 flex justify-center">
                <ProjectRealtimeStatusBanner />
              </div>
            </>
          ) : (
            <p role="status" className="text-sm font-medium text-muted-foreground">
              여행 일정 데이터를 불러오는 중입니다.
            </p>
          )}
        </section>
      </main>
    );
  }

  return (
    <CursorPresenceLayer controller={presenceController} enabled={isReady}>
      {!isReady || featureError ? (
        <div className="absolute top-3 right-3 z-70 max-w-sm rounded-xl bg-card/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
          <ProjectRealtimeStatusBanner />
          {featureError ? (
            <p role="alert" className="mt-1 text-destructive">
              {featureError.message}
            </p>
          ) : null}
        </div>
      ) : null}
      <PlannerWorkspace
        isNodeMoveEnabled={isReady && !isNodeMovePending}
        onMoveNode={handleMoveNode}
        plannerCommands={isReady ? plannerNodeEditingCommands : undefined}
        projectId={projectId}
        chatContent={
          <RealtimeChatPanel
            currentUserId={identity.id}
            currentUserName={identity.name}
            historyStatus={chatHistoryStatus}
            isReady={isReady}
            memberInviteContent={
              <ProjectMemberInviteForm client={restClient} projectId={projectId} />
            }
            messages={messages}
            onRetryHistory={() => void loadChatHistory().catch(() => undefined)}
            onSend={handleSend}
          />
        }
      />
    </CursorPresenceLayer>
  );
}
