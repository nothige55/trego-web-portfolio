// 하나의 SignalR 연결 위에 planner·chat·cursor presence 구독을 함께 얹음
// 여러 feature를 묶는 지점이라 app 레이어에 두고, 각 Hub 계약은 feature의 realtime 모듈이 소유

import { useCallback, useRef, useState } from "react";

import type { AuthSession } from "@/features/auth/types";
import { type ChatMessage, subscribeToChatMessages } from "@/features/chat";
import {
  createCursorPresenceController,
  type CursorPresenceController,
} from "@/features/collaboration/realtime/cursor-presence-controller";
import type { PlannerCommandInvoker } from "@/features/planner/hooks/use-planner-recorded-operations";
import {
  createPlannerRealtime,
  type PlannerRealtimeCommands,
} from "@/features/planner/realtime/planner-realtime";
import { usePlannerViewStore } from "@/features/planner/stores/planner-view-store";
import type { SignalRClient } from "@/lib/signalr-client";

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export type ProjectRealtimeSubscriptions = {
  readonly invokePlannerCommand: PlannerCommandInvoker;
  readonly presenceController: CursorPresenceController | null;
  readonly registerSubscriptions: (client: SignalRClient) => () => void;
};

export function useProjectRealtimeSubscriptions({
  identity,
  projectId,
  onChatMessage,
  reportError,
  resync,
}: {
  readonly identity: AuthSession;
  readonly projectId: string;
  readonly onChatMessage: (message: ChatMessage) => void;
  readonly reportError: (error: Error | null) => void;
  readonly resync: () => Promise<void>;
}): ProjectRealtimeSubscriptions {
  const [presenceController, setPresenceController] = useState<CursorPresenceController | null>(
    null,
  );
  const plannerCommandsRef = useRef<PlannerRealtimeCommands | null>(null);

  const registerSubscriptions = useCallback(
    (client: SignalRClient) => {
      const plannerRealtime = createPlannerRealtime(client, {
        getNodes: () => usePlannerViewStore.getState().nodes,
        setNodes: (nodes) => usePlannerViewStore.getState().replaceNodes(nodes),
        applyProjectUpdate: (update) => usePlannerViewStore.getState().setProjectDetails(update),
        reportError: (error) => reportError(toError(error)),
        resync,
      });
      plannerCommandsRef.current = plannerRealtime.commands;
      const unsubscribePlanner = plannerRealtime.subscribe();
      const unsubscribeChat = subscribeToChatMessages(client, {
        onMessageReceived: onChatMessage,
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
    [identity.id, onChatMessage, projectId, reportError, resync],
  );

  const invokePlannerCommand = useCallback<PlannerCommandInvoker>(
    async (invoke) => {
      const commands = plannerCommandsRef.current;

      if (!commands) {
        const error = new Error("Planner 실시간 명령을 사용할 수 없습니다.");
        reportError(error);
        throw error;
      }

      reportError(null);

      try {
        await invoke(commands);
      } catch (error) {
        // adapter의 canonical resync가 끝난 뒤에도 사용자가 실패 원인을 확인할 수 있게 남김
        reportError(toError(error));
        throw error;
      }
    },
    [reportError],
  );

  return { invokePlannerCommand, presenceController, registerSubscriptions };
}
