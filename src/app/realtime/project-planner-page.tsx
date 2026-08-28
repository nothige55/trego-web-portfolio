import { useCallback, useMemo, useState } from "react";

import { ProjectChatTabs } from "@/app/realtime/project-chat-tabs";
import { ProjectPlannerFallbackScreen } from "@/app/realtime/project-planner-fallback-screen";
import { useProjectRealtime } from "@/app/realtime/project-realtime-context";
import {
  ProjectRealtimeProvider,
  ProjectRealtimeStatusBanner,
} from "@/app/realtime/project-realtime-provider";
import { useAiPlannerContext } from "@/app/realtime/use-ai-planner-context";
import {
  type ProjectDataState,
  useProjectDataLoader,
} from "@/app/realtime/use-project-data-loader";
import { useProjectRealtimeSubscriptions } from "@/app/realtime/use-project-realtime-subscriptions";
import { env } from "@/config/env";
import { createAiPlannerApiClient } from "@/features/ai-planner/api/ai-planner-api-client";
import { mockAiPlannerClient } from "@/features/ai-planner/api/mock-ai-planner-client";
import { AiPlannerPanel } from "@/features/ai-planner/components/ai-planner-panel";
import type { AuthSession } from "@/features/auth/types";
import {
  type ChatMessage,
  createSendChatMessageCommand,
  type SendChatMessageResult,
} from "@/features/chat";
import { RealtimeChatPanel } from "@/features/chat/components/realtime-chat-panel";
import { CursorPresenceLayer } from "@/features/collaboration/components/cursor-presence-layer";
import type { CursorPresenceController } from "@/features/collaboration/realtime/cursor-presence-controller";
import { MockPlaceExplorer } from "@/features/places/components/mock-place-explorer";
import { PlannerWorkspace } from "@/features/planner/components/planner-workspace";
import { usePlannerNodeMove } from "@/features/planner/hooks/use-planner-node-move";
import { usePlannerRecordedOperations } from "@/features/planner/hooks/use-planner-recorded-operations";
import { createPlannerEditingCommands } from "@/features/planner/operations/build-planner-editing-commands";
import type { UpdatePathInput } from "@/features/planner/realtime/project-hub-planner-contracts";
import { usePlannerHistoryStore } from "@/features/planner/stores/planner-history-store";
import type { PlannerNodeEditingCommands } from "@/features/planner/types/planner-editing-commands";
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

// planner·chat·collaboration을 하나의 실시간 세션 위에서 묶는 유일한 지점이다.
// 데이터 적재, 구독 등록, 편집 명령 조립은 각각 hook과 feature 모듈이 소유하고 여기서는 배선만 한다.
export function ProjectPlannerPage({
  clientFactory,
  identity,
  projectId,
  restClient: injectedRestClient,
}: ProjectPlannerPageProps) {
  const [featureError, setFeatureError] = useState<Error | null>(null);
  const authorizedRestClient = useMemo(
    () =>
      injectedRestClient ??
      createApiClient({
        getAccessToken: () => identity.accessToken,
      }),
    [identity.accessToken, injectedRestClient],
  );
  const {
    appendChatMessage,
    chatHistoryStatus,
    loadChatHistory,
    messages,
    projectDataState,
    reload,
  } = useProjectDataLoader({ projectId, restClient: authorizedRestClient });

  const resync = useCallback(async () => {
    await reload();
    usePlannerHistoryStore.getState().clear();
    setFeatureError(null);
  }, [reload]);

  const { invokePlannerCommand, presenceController, registerSubscriptions } =
    useProjectRealtimeSubscriptions({
      identity,
      projectId,
      onChatMessage: appendChatMessage,
      reportError: setFeatureError,
      resync,
    });
  const { replayHistory, runRecordedOperation, updatePath } =
    usePlannerRecordedOperations(invokePlannerCommand);
  const plannerNodeEditingCommands = useMemo<PlannerNodeEditingCommands>(
    () => createPlannerEditingCommands({ replayHistory, runRecordedOperation }),
    [replayHistory, runRecordedOperation],
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
        projectDataState={projectDataState}
        projectId={projectId}
        restClient={authorizedRestClient}
        updatePlannerPath={updatePath}
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
  const sendMessage = useMemo(() => createSendChatMessageCommand(client), [client]);
  const handleSend = useCallback(
    (content: string): Promise<SendChatMessageResult> =>
      sendMessage({ content, memberId: identity.id, projectId }),
    [identity.id, projectId, sendMessage],
  );
  const { isMovePending, moveNode } = usePlannerNodeMove({
    isEnabled: isReady,
    updatePath: updatePlannerPath,
  });
  const aiContextItems = useAiPlannerContext();
  const aiPlannerClient = useMemo(
    () =>
      env.aiPlannerMode === "api"
        ? createAiPlannerApiClient({
            accessToken: identity.accessToken,
            apiBaseUrl: env.apiBaseUrl,
            projectId,
          })
        : mockAiPlannerClient,
    [identity.accessToken, projectId],
  );

  if (projectDataState.status !== "ready") {
    return <ProjectPlannerFallbackScreen error={projectDataState.error ?? sessionError} />;
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
        exploreContent={<MockPlaceExplorer />}
        isNodeMoveEnabled={isReady && !isMovePending}
        onMoveNode={moveNode}
        plannerCommands={isReady ? plannerNodeEditingCommands : undefined}
        projectId={projectId}
        chatContent={
          <ProjectChatTabs
            aiContent={<AiPlannerPanel client={aiPlannerClient} contextItems={aiContextItems} />}
            teamContent={
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
        }
      />
    </CursorPresenceLayer>
  );
}
