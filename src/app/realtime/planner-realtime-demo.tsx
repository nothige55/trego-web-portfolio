import { useCallback, useMemo, useState } from "react";

import { useProjectRealtime } from "@/app/realtime/project-realtime-context";
import {
  ProjectRealtimeProvider,
  ProjectRealtimeStatusBanner,
} from "@/app/realtime/project-realtime-provider";
import type { RealtimeDemoIdentity } from "@/app/realtime/realtime-demo-login";
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
import type { ApiClient } from "@/lib/api-client";
import { createApiClient } from "@/lib/api-client";
import type { SignalRClient, SignalRClientOptions } from "@/lib/signalr-client";

type PlannerRealtimeDemoProps = {
  readonly clientFactory?: (options: SignalRClientOptions) => SignalRClient;
  readonly identity: RealtimeDemoIdentity;
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
  const [messages, setMessages] = useState<readonly ChatMessage[]>([]);
  const [presenceController, setPresenceController] = useState<CursorPresenceController | null>(
    null,
  );
  const [featureError, setFeatureError] = useState<Error | null>(null);
  const authorizedRestClient = useMemo(
    () =>
      injectedRestClient ??
      createApiClient({
        getAccessToken: () => identity.accessToken,
      }),
    [identity.accessToken, injectedRestClient],
  );

  const resync = useCallback(async () => {
    const [projectDetails, nodes, history] = await Promise.all([
      getProjectDetails(projectId, authorizedRestClient),
      getProjectNodes(projectId, authorizedRestClient),
      getChatMessages(projectId, authorizedRestClient),
    ]);

    const plannerStore = usePlannerViewStore.getState();
    plannerStore.setProjectDetails(projectDetails);
    plannerStore.replaceNodes(nodes);
    setMessages(replaceChatMessagesFromHistory(history));
    setFeatureError(null);
  }, [authorizedRestClient, projectId]);

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

          setMessages((current) => mergeChatMessages(current, [message]));
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
        identity={identity}
        messages={messages}
        onLogout={onLogout}
        presenceController={presenceController}
        projectId={projectId}
      />
    </ProjectRealtimeProvider>
  );
}

type PlannerRealtimeDemoContentProps = {
  readonly featureError: Error | null;
  readonly identity: RealtimeDemoIdentity;
  readonly messages: readonly ChatMessage[];
  readonly onLogout: () => void;
  readonly presenceController: CursorPresenceController | null;
  readonly projectId: string;
};

function PlannerRealtimeDemoContent({
  featureError,
  identity,
  messages,
  onLogout,
  presenceController,
  projectId,
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
            isReady={isReady}
            messages={messages}
            onLogout={onLogout}
            onSend={handleSend}
          />
        }
      />
    </CursorPresenceLayer>
  );
}
