import type { DemoProjectServer, DemoServerConnection } from "@/app/demo/demo-project-server";
import type { DemoMember } from "@/app/demo/demo-seed";
import { simulateLatency } from "@/app/demo/simulate-latency";
import type { SendMessageHubRequest } from "@/features/chat/types/chat-message";
import type {
  PlannerHubCommandMap,
  PlannerHubCommandName,
} from "@/features/planner/realtime/project-hub-planner-contracts";
import type { PlannerActivityNode, PlannerNode } from "@/features/planner/types/planner-node";

const DEFAULT_FIRST_ACTION_DELAY_MS = 4_000;
const DEFAULT_ACTION_INTERVAL_MS = 12_000;
const DEFAULT_HOLD_RETRY_MS = 1_000;
const DEFAULT_CHAT_DELAY_MS = 1_500;
const DEFAULT_CURSOR_INTERVAL_MS = 100;

// 커서는 일정 목록 쪽을 천천히 돌아다닌다. 좌표는 Planner 영역 기준 비율이다.
const CURSOR_AREA = { minX: 0.08, maxX: 0.42, minY: 0.2, maxY: 0.85 } as const;
const CURSOR_EASING = 0.12;

const BLACK_PORK_PATH_ID = "demo-collaborator-black-pork";

export interface DemoCollaboratorOptions {
  readonly actionIntervalMs?: number;
  readonly canTouch: (node: PlannerNode) => boolean;
  readonly chatDelayMs?: number;
  readonly cursorIntervalMs?: number;
  readonly firstActionDelayMs?: number;
  readonly member: DemoMember;
  readonly random?: () => number;
  readonly server: DemoProjectServer;
  readonly shouldHold?: () => boolean;
}

export interface DemoCollaborator {
  isRunning: () => boolean;
  start: () => void;
  stop: () => void;
}

// null은 조건이 맞지 않아 건너뛴 단계, 객체는 실행한 단계다.
type StepResult = { readonly chat?: string } | null;

type StepContext = {
  readonly findTouchable: (pathId: string) => PlannerNode | null;
  readonly nodes: readonly PlannerNode[];
  readonly send: <TName extends PlannerHubCommandName>(
    methodName: TName,
    request: PlannerHubCommandMap[TName],
  ) => Promise<void>;
};

type Step = (context: StepContext) => Promise<StepResult>;

class CollaboratorStoppedError extends Error {}

function getSiblings(nodes: readonly PlannerNode[], parentPathId: string): readonly PlannerNode[] {
  return nodes.filter((node) => node.parentPathId === parentPathId);
}

function isActivity(node: PlannerNode | null): node is PlannerActivityNode {
  return node?.kind === "activity";
}

// 이름·메모·순서를 원래 값과 번갈아 바꾸는 토글로만 구성해, 반복해도 일정이 불어나지 않게 한다.
function createScript(): readonly Step[] {
  const originalNames = new Map<string, string>();
  const originalMemos = new Map<string, string | null>();

  return [
    async ({ findTouchable, nodes, send }) => {
      const blackPork = nodes.find((node) => node.pathId === BLACK_PORK_PATH_ID) ?? null;

      if (blackPork) {
        if (!findTouchable(BLACK_PORK_PATH_ID)) {
          return null;
        }

        await send("DeleteNode", { pathId: BLACK_PORK_PATH_ID });
        return { chat: "흑돼지거리는 일단 뺄게요. 마지막 날에 다시 볼게요." };
      }

      const day = findTouchable("day-three");

      if (!day) {
        return null;
      }

      const positions = getSiblings(nodes, day.pathId).map((node) => node.position);
      await send("CreateActivity", {
        id: `${BLACK_PORK_PATH_ID}-entity`,
        name: "흑돼지거리",
        pathId: BLACK_PORK_PATH_ID,
        parentPathId: day.pathId,
        position: Math.max(-1, ...positions) + 1,
        type: "single",
        marker: "favorite",
        travelMode: null,
        travelTimeMinutes: 0,
        travelDistanceMeters: 0,
        travelCost: "",
        lat: 33.5129,
        lng: 126.5282,
        rating: 0,
        ratingCount: 0,
        googleId: BLACK_PORK_PATH_ID,
      });
      return { chat: "3일차 저녁에 흑돼지거리 넣어 봤어요. 동문시장이랑 가까워요!" };
    },
    async ({ findTouchable, send }) => {
      const market = findTouchable("day-three-dongmun");

      if (!isActivity(market)) {
        return null;
      }

      const alternateName = "동문시장 야시장";

      if (market.name !== alternateName) {
        originalNames.set(market.pathId, market.name);
      }

      await send("UpdateActivity", {
        id: market.id,
        name:
          market.name === alternateName
            ? (originalNames.get(market.pathId) ?? "동문시장")
            : alternateName,
      });
      return {};
    },
    async ({ findTouchable, send }) => {
      const seongsan = findTouchable("day-seven-seongsan");

      if (!isActivity(seongsan)) {
        return null;
      }

      const sunriseMemo = "일출 05:40 · 30분 전 도착해서 줄 서기";

      if (seongsan.memo === sunriseMemo) {
        await send("UpdateActivity", {
          id: seongsan.id,
          memo: originalMemos.get(seongsan.pathId) ?? null,
        });
        return {};
      }

      originalMemos.set(seongsan.pathId, seongsan.memo);
      await send("UpdateActivity", { id: seongsan.id, memo: sunriseMemo });
      return { chat: "성산일출봉 메모에 일출 시간 적어 뒀어요." };
    },
    async ({ findTouchable, nodes, send }) => {
      const camellia = findTouchable("day-four-camellia");

      if (!camellia?.parentPathId) {
        return null;
      }

      const positions = getSiblings(nodes, camellia.parentPathId).map((node) => node.position);
      const isFirst = camellia.position <= Math.min(...positions);
      await send("UpdatePath", {
        pathId: camellia.pathId,
        parentPathId: camellia.parentPathId,
        position: isFirst ? Math.max(...positions) + 1 : Math.min(...positions) - 1,
      });
      return isFirst ? {} : { chat: "카멜리아힐은 오전에 가야 덜 붐빈대요. 앞으로 옮겼어요." };
    },
  ];
}

// 서버에 별도 접속자로 참여하는 가상의 동료다.
// 사용자 탭을 거치지 않고 Hub 명령을 보내므로, 화면에는 실제 원격 변경과 같은 경로로 도착한다.
export function createDemoCollaborator({
  actionIntervalMs = DEFAULT_ACTION_INTERVAL_MS,
  canTouch,
  chatDelayMs = DEFAULT_CHAT_DELAY_MS,
  cursorIntervalMs = DEFAULT_CURSOR_INTERVAL_MS,
  firstActionDelayMs = DEFAULT_FIRST_ACTION_DELAY_MS,
  member,
  random = Math.random,
  server,
  shouldHold = () => false,
}: DemoCollaboratorOptions): DemoCollaborator {
  const script = createScript();
  let connection: DemoServerConnection | null = null;
  let generation = 0;
  let stepIndex = 0;
  let actionTimer: ReturnType<typeof setTimeout> | null = null;
  let cursorTimer: ReturnType<typeof setInterval> | null = null;
  let cursor = { x: 0.3, y: 0.4 };
  let cursorTarget = { x: 0.2, y: 0.6 };

  function pickCursorTarget(): { x: number; y: number } {
    return {
      x: CURSOR_AREA.minX + random() * (CURSOR_AREA.maxX - CURSOR_AREA.minX),
      y: CURSOR_AREA.minY + random() * (CURSOR_AREA.maxY - CURSOR_AREA.minY),
    };
  }

  function invokeWhileActive(
    runGeneration: number,
    methodName: string,
    ...args: readonly unknown[]
  ): Promise<void> {
    if (runGeneration !== generation || !connection) {
      return Promise.reject(new CollaboratorStoppedError());
    }

    return connection.invoke(methodName, args);
  }

  function moveCursor(runGeneration: number): void {
    if (shouldHold()) {
      return;
    }

    cursor = {
      x: cursor.x + (cursorTarget.x - cursor.x) * CURSOR_EASING,
      y: cursor.y + (cursorTarget.y - cursor.y) * CURSOR_EASING,
    };

    if (Math.hypot(cursorTarget.x - cursor.x, cursorTarget.y - cursor.y) < 0.01) {
      cursorTarget = pickCursorTarget();
    }

    void invokeWhileActive(runGeneration, "UpdateCursor", member.id, cursor.x, cursor.y).catch(
      () => undefined,
    );
  }

  async function runNextStep(runGeneration: number): Promise<void> {
    const { nodes } = server.getSnapshot();
    const context: StepContext = {
      nodes,
      findTouchable(pathId) {
        const node = nodes.find((candidate) => candidate.pathId === pathId) ?? null;
        return node && canTouch(node) ? node : null;
      },
      send: (methodName, request) => invokeWhileActive(runGeneration, methodName, request),
    };

    for (let attempt = 0; attempt < script.length; attempt += 1) {
      const step = script[stepIndex];
      stepIndex = (stepIndex + 1) % script.length;
      const result = await step(context);

      if (result) {
        if (result.chat) {
          await simulateLatency(chatDelayMs);
          const message: SendMessageHubRequest = {
            MemberId: member.id,
            ProjectId: server.getSnapshot().project.publicId,
            Content: result.chat,
            Type: "member",
          };
          await invokeWhileActive(runGeneration, "SendMessage", message);
        }

        return;
      }
    }
  }

  function scheduleAction(runGeneration: number, delay: number): void {
    actionTimer = setTimeout(() => {
      actionTimer = null;

      if (runGeneration !== generation) {
        return;
      }

      if (shouldHold()) {
        scheduleAction(runGeneration, DEFAULT_HOLD_RETRY_MS);
        return;
      }

      void runNextStep(runGeneration)
        .catch(() => undefined)
        .finally(() => {
          if (runGeneration === generation) {
            scheduleAction(runGeneration, actionIntervalMs);
          }
        });
    }, delay);
  }

  function clearTimers(): void {
    if (actionTimer !== null) {
      clearTimeout(actionTimer);
      actionTimer = null;
    }

    if (cursorTimer !== null) {
      clearInterval(cursorTimer);
      cursorTimer = null;
    }
  }

  return {
    isRunning() {
      return connection !== null;
    },
    start() {
      if (connection) {
        return;
      }

      const runGeneration = ++generation;
      connection = server.connect(() => undefined);
      void invokeWhileActive(runGeneration, "JoinProject", server.getSnapshot().project.publicId)
        .then(() => {
          if (runGeneration !== generation) {
            return;
          }

          cursorTimer = setInterval(() => moveCursor(runGeneration), cursorIntervalMs);
          scheduleAction(runGeneration, firstActionDelayMs);
        })
        .catch(() => undefined);
    },
    stop() {
      generation += 1;
      clearTimers();
      connection?.close();
      connection = null;
    },
  };
}
