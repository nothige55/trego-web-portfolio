// /demo가 쓰는 데모 사용자·가상 동료와 첫 화면 상태(일정, 채팅 기록)를 정의
// 일정은 planner의 demoPlannerProject를 재사용하되 드롭 규칙 검증용 서브트리는 뺌

import type { AuthSession } from "@/features/auth/types";
import type { ChatMessage } from "@/features/chat/types/chat-message";
import { demoPlannerProject } from "@/features/planner/data/demo-planner";
import type { PlannerNode } from "@/features/planner/types/planner-node";
import type { PlannerProjectDetails } from "@/features/planner/types/planner-project";

export const DEMO_PROJECT_ID = demoPlannerProject.publicId;

export type DemoMember = {
  readonly id: string;
  readonly name: string;
};

export type DemoProjectSeed = {
  readonly messages: readonly ChatMessage[];
  readonly nodes: readonly PlannerNode[];
  readonly project: PlannerProjectDetails;
};

export const DEMO_IDENTITY: AuthSession = {
  accessToken: "demo",
  email: "demo@trego.local",
  id: "demo-me",
  name: "나",
};

// 원격 커서 라벨은 userId 앞 8자를 그대로 보여 주므로 짧고 읽히는 id를 씀
export const DEMO_COLLABORATOR: DemoMember = {
  id: "minji",
  name: "민지",
};

export const DEMO_MEMBERS: readonly DemoMember[] = [DEMO_IDENTITY, DEMO_COLLABORATOR];

// 동료가 주로 편집하는 3일차를 첫 화면에 펼쳐 둠
export const DEMO_INITIAL_EXPANDED_PATH_IDS: readonly string[] = ["region-jeju", "day-three"];

// 테스트 fixture에는 드롭 규칙 검증용 노드가 섞여 있음. 리뷰어에게 보이는 일정에서는 서브트리째 뺌
const TEST_ONLY_ROOT_PATH_IDS: ReadonlySet<string> = new Set(["empty-wish", "dnd-test-day"]);

function excludeSubtrees(
  nodes: readonly PlannerNode[],
  rootPathIds: ReadonlySet<string>,
): readonly PlannerNode[] {
  const excludedPathIds = new Set(rootPathIds);
  let foundChild = true;

  while (foundChild) {
    foundChild = false;
    nodes.forEach((node) => {
      if (
        node.parentPathId &&
        excludedPathIds.has(node.parentPathId) &&
        !excludedPathIds.has(node.pathId)
      ) {
        excludedPathIds.add(node.pathId);
        foundChild = true;
      }
    });
  }

  return nodes.filter((node) => !excludedPathIds.has(node.pathId));
}

function minutesAgo(now: number, minutes: number): string {
  return new Date(now - minutes * 60_000).toISOString();
}

export function createDemoProjectSeed(now = Date.now()): DemoProjectSeed {
  const { nodes, ...project } = demoPlannerProject;

  return {
    project,
    nodes: excludeSubtrees(nodes, TEST_ONLY_ROOT_PATH_IDS),
    messages: [
      {
        messageId: 1,
        memberId: DEMO_COLLABORATOR.id,
        memberName: DEMO_COLLABORATOR.name,
        content: "제주 일정 초안 올려 뒀어요. 편하게 고쳐 주세요!",
        type: "member",
        createdAt: minutesAgo(now, 42),
        projectId: DEMO_PROJECT_ID,
      },
      {
        messageId: 2,
        memberId: DEMO_IDENTITY.id,
        memberName: DEMO_IDENTITY.name,
        content: "좋아요. 서귀포 쪽 동선 한번 볼게요.",
        type: "member",
        createdAt: minutesAgo(now, 38),
        projectId: DEMO_PROJECT_ID,
      },
    ],
  };
}
