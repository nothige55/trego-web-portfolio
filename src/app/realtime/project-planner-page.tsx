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
import { PlannerWorkspace } from "@/features/planner/components/planner-workspace";
import { createPlannerRealtime } from "@/features/planner/realtime/planner-realtime";
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
      }
    };
  }, [loadChatHistory, loadProjectData, projectId]);

  const resync = useCallback(async () => {
    await Promise.all([loadProjectData(), loadChatHistory()]);
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
        unsubscribePlanner();
        unsubscribeChat();
        controller.dispose();
      };
    },
    [identity.id, projectId, resync],
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
        presenceController={presenceController}
        projectDataState={
          projectDataState.projectId === projectId
            ? projectDataState
            : { error: null, projectId, status: "loading" }
        }
        projectId={projectId}
        restClient={authorizedRestClient}
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
  readonly presenceController: CursorPresenceController | null;
  readonly projectDataState: ProjectDataState;
  readonly projectId: string;
  readonly restClient: ApiClient;
};

function ProjectPlannerPageContent({
  chatHistoryStatus,
  featureError,
  identity,
  loadChatHistory,
  messages,
  presenceController,
  projectDataState,
  projectId,
  restClient,
}: ProjectPlannerPageContentProps) {
  const { client, error: sessionError, isReady } = useProjectRealtime();
  const sendMessage = useMemo(() => createSendChatMessageCommand(client), [client]);
  const handleSend = useCallback(
    (content: string): Promise<SendChatMessageResult> =>
      sendMessage({ content, memberId: identity.id, projectId }),
    [identity.id, projectId, sendMessage],
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
