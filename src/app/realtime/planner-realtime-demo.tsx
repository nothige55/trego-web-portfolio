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
import { usePlannerViewStore } from "@/features/planner/stores/planner-view-store";
import { ProjectMemberInviteForm } from "@/features/project-management/components/project-member-invite-form";
import type { ApiClient } from "@/lib/api-client";
import { createApiClient } from "@/lib/api-client";
import type { SignalRClient, SignalRClientOptions } from "@/lib/signalr-client";

type PlannerRealtimeDemoProps = {
  readonly clientFactory?: (options: SignalRClientOptions) => SignalRClient;
  readonly identity: AuthSession;
  readonly onLogout: () => void;
  readonly projectId: string;
  readonly restClient?: ApiClient;
};

export function PlannerRealtimeDemo({
  clientFactory,
  identity,
  onLogout,
  projectId,
  restClient: injectedRestClient,
}: PlannerRealtimeDemoProps) {
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
  const activeProjectIdRef = useRef<string | null>(projectId);
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

  useEffect(() => {
    activeProjectIdRef.current = projectId;
    void loadChatHistory().catch(() => undefined);

    return () => {
      if (activeProjectIdRef.current === projectId) {
        activeProjectIdRef.current = null;
      }
    };
  }, [loadChatHistory, projectId]);

  const resync = useCallback(async () => {
    const [projectDetails, nodes] = await Promise.all([
      getProjectDetails(projectId, authorizedRestClient),
      getProjectNodes(projectId, authorizedRestClient),
    ]);

    const plannerStore = usePlannerViewStore.getState();
    plannerStore.setProjectDetails(projectDetails);
    plannerStore.replaceNodes(nodes);
    await loadChatHistory();
    setFeatureError(null);
  }, [authorizedRestClient, loadChatHistory, projectId]);

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
      <PlannerRealtimeDemoContent
        featureError={featureError}
        chatHistoryStatus={chatHistoryStatus}
        identity={identity}
        loadChatHistory={loadChatHistory}
        messages={messages}
        onLogout={onLogout}
        presenceController={presenceController}
        projectId={projectId}
        restClient={authorizedRestClient}
      />
    </ProjectRealtimeProvider>
  );
}

type PlannerRealtimeDemoContentProps = {
  readonly chatHistoryStatus: "error" | "loading" | "ready";
  readonly featureError: Error | null;
  readonly identity: AuthSession;
  readonly loadChatHistory: () => Promise<void>;
  readonly messages: readonly ChatMessage[];
  readonly onLogout: () => void;
  readonly presenceController: CursorPresenceController | null;
  readonly projectId: string;
  readonly restClient: ApiClient;
};

function PlannerRealtimeDemoContent({
  chatHistoryStatus,
  featureError,
  identity,
  loadChatHistory,
  messages,
  onLogout,
  presenceController,
  projectId,
  restClient,
}: PlannerRealtimeDemoContentProps) {
  const { client, isReady } = useProjectRealtime();
  const sendMessage = useMemo(() => createSendChatMessageCommand(client), [client]);
  const handleSend = useCallback(
    (content: string): Promise<SendChatMessageResult> =>
      sendMessage({ content, memberId: identity.id, projectId }),
    [identity.id, projectId, sendMessage],
  );

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
            onLogout={onLogout}
            onRetryHistory={() => void loadChatHistory().catch(() => undefined)}
            onSend={handleSend}
          />
        }
      />
    </CursorPresenceLayer>
  );
}
