import type { DemoMember, DemoProjectSeed } from "@/app/demo/demo-seed";
import { simulateLatency } from "@/app/demo/simulate-latency";
import type { ChatMessage, SendMessageHubRequest } from "@/features/chat/types/chat-message";
import { reducePlannerHubEvent } from "@/features/planner/realtime/planner-realtime-reducer";
import type {
  PlannerHubCommandName,
  PlannerHubEvent,
  PlannerHubEventName,
  UpdateProjectRequest,
} from "@/features/planner/realtime/project-hub-planner-contracts";
import type { PlannerNode } from "@/features/planner/types/planner-node";
import type { PlannerProjectDetails } from "@/features/planner/types/planner-project";

// 실제 Hub처럼 명령 이름과 되쏘는 이벤트 이름을 1:1로 맞춘다.
const PLANNER_COMMAND_EVENTS = {
  CreateFolder: "OnFolderCreated",
  CreateDay: "OnDayCreated",
  CreateActivity: "OnActivityCreated",
  UpdatePath: "OnPathUpdated",
  UpdateProject: "OnProjectDateUpdated",
  UpdateFolder: "OnFolderUpdated",
  UpdateDay: "OnDayUpdated",
  UpdateActivity: "OnActivityUpdated",
  DeleteNode: "OnNodeDeleted",
} as const satisfies Record<PlannerHubCommandName, PlannerHubEventName>;

const DEFAULT_LATENCY_MS = 120;

export type DemoServerEventListener = (eventName: string, args: readonly unknown[]) => void;

export interface DemoServerConnection {
  readonly connectionId: string;
  close: () => void;
  invoke: (methodName: string, args: readonly unknown[]) => Promise<void>;
}

export interface DemoProjectSnapshot {
  readonly messages: readonly ChatMessage[];
  readonly nodes: readonly PlannerNode[];
  readonly project: PlannerProjectDetails;
}

export interface DemoProjectServer {
  connect: (listener: DemoServerEventListener) => DemoServerConnection;
  getSnapshot: () => DemoProjectSnapshot;
}

export interface DemoProjectServerOptions {
  readonly latencyMs?: number;
  readonly members: readonly DemoMember[];
  readonly now?: () => number;
  readonly seed: DemoProjectSeed;
}

type ConnectionState = {
  readonly listener: DemoServerEventListener;
  isClosed: boolean;
  isJoined: boolean;
};

export class DemoConnectionClosedError extends Error {
  constructor() {
    super("데모 서버와의 연결이 끊겼습니다.");
    this.name = "DemoConnectionClosedError";
  }
}

function isPlannerCommand(methodName: string): methodName is PlannerHubCommandName {
  return Object.hasOwn(PLANNER_COMMAND_EVENTS, methodName);
}

// 브라우저 안에서 도는 가짜 백엔드다. 실제 서버의 성질을 일부러 그대로 따른다.
// - 요청 payload를 검증 없이 그룹 전원에게 되쏜다. 보낸 접속자도 echo를 받는다.
// - 이벤트는 참여 중인 접속자에게만 간다. 끊긴 동안의 이벤트는 쌓아 두지 않고 버린다.
// - 기준 상태는 REST 스냅샷으로만 다시 받을 수 있다.
// 그래야 데모에서도 idempotent reducer, 실패 시 resync, 재연결 복구 코드가 실제로 돈다.
export function createDemoProjectServer({
  latencyMs = DEFAULT_LATENCY_MS,
  members,
  now = Date.now,
  seed,
}: DemoProjectServerOptions): DemoProjectServer {
  const connections = new Map<string, ConnectionState>();
  const memberNames = new Map(members.map((member) => [member.id, member.name]));
  let project = seed.project;
  let nodes = seed.nodes;
  let messages = seed.messages;
  let nextConnectionNumber = 1;
  let nextMessageId = Math.max(0, ...seed.messages.map((message) => message.messageId)) + 1;

  function broadcast(
    eventName: string,
    args: readonly unknown[],
    { excludeConnectionId }: { readonly excludeConnectionId?: string } = {},
  ): void {
    connections.forEach((connection, connectionId) => {
      if (connection.isJoined && !connection.isClosed && connectionId !== excludeConnectionId) {
        connection.listener(eventName, args);
      }
    });
  }

  function applyPlannerCommand(methodName: PlannerHubCommandName, payload: unknown): void {
    const eventName = PLANNER_COMMAND_EVENTS[methodName];

    if (eventName === "OnProjectDateUpdated") {
      const { publicId, title, startDate, endDate, isPublic } = payload as UpdateProjectRequest;
      project = { publicId, title, startDate, endDate, isPublic };
    } else {
      nodes = reducePlannerHubEvent(nodes, { name: eventName, payload } as PlannerHubEvent);
    }

    broadcast(eventName, [payload]);
  }

  function receiveChatMessage(request: SendMessageHubRequest): void {
    const message: ChatMessage = {
      messageId: nextMessageId++,
      memberId: request.MemberId,
      memberName: memberNames.get(request.MemberId),
      content: request.Content,
      type: request.Type,
      createdAt: new Date(now()).toISOString(),
      projectId: request.ProjectId,
    };
    messages = [...messages, message];
    broadcast("OnMessageReceived", [message]);
  }

  function handleInvoke(
    connectionId: string,
    connection: ConnectionState,
    methodName: string,
    args: readonly unknown[],
  ): void {
    if (methodName === "JoinProject") {
      if (args[0] !== project.publicId) {
        throw new Error("프로젝트를 찾을 수 없습니다.");
      }

      connection.isJoined = true;
      return;
    }

    if (methodName === "SendMessage") {
      receiveChatMessage(args[0] as SendMessageHubRequest);
      return;
    }

    if (methodName === "UpdateCursor") {
      broadcast("OnCursorUpdated", args, { excludeConnectionId: connectionId });
      return;
    }

    if (isPlannerCommand(methodName)) {
      applyPlannerCommand(methodName, args[0]);
      return;
    }

    throw new Error(`알 수 없는 Hub 메서드입니다: ${methodName}`);
  }

  return {
    connect(listener) {
      const connectionId = `demo-connection-${nextConnectionNumber++}`;
      const connection: ConnectionState = { listener, isClosed: false, isJoined: false };
      connections.set(connectionId, connection);

      return {
        connectionId,
        close() {
          connection.isClosed = true;
          connections.delete(connectionId);
        },
        async invoke(methodName, args) {
          await simulateLatency(latencyMs);

          if (connection.isClosed) {
            throw new DemoConnectionClosedError();
          }

          handleInvoke(connectionId, connection, methodName, args);
        },
      };
    },
    getSnapshot() {
      return { messages, nodes, project };
    },
  };
}
