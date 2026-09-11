import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDemoCollaborator } from "@/app/demo/demo-collaborator";
import { createDemoProjectServer } from "@/app/demo/demo-project-server";
import {
  createDemoProjectSeed,
  DEMO_COLLABORATOR,
  DEMO_MEMBERS,
  DEMO_PROJECT_ID,
} from "@/app/demo/demo-seed";
import type { PlannerNode } from "@/features/planner/types/planner-node";

function setup({
  canTouch = () => true,
  shouldHold = () => false,
}: {
  canTouch?: (node: PlannerNode) => boolean;
  shouldHold?: () => boolean;
} = {}) {
  const server = createDemoProjectServer({
    latencyMs: 0,
    members: DEMO_MEMBERS,
    seed: createDemoProjectSeed(),
  });
  const observer = vi.fn();
  const observerConnection = server.connect(observer);
  const collaborator = createDemoCollaborator({
    actionIntervalMs: 1_000,
    canTouch,
    chatDelayMs: 100,
    cursorIntervalMs: 50,
    firstActionDelayMs: 500,
    member: DEMO_COLLABORATOR,
    random: () => 0.5,
    server,
    shouldHold,
  });

  return { collaborator, observer, observerConnection, server };
}

function findNode(nodes: readonly PlannerNode[], pathId: string) {
  return nodes.find((node) => node.pathId === pathId);
}

describe("createDemoCollaborator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("edits through the Hub like another member and chats about it", async () => {
    const { collaborator, observer, observerConnection, server } = setup();
    await observerConnection.invoke("JoinProject", [DEMO_PROJECT_ID]);

    collaborator.start();
    await vi.advanceTimersByTimeAsync(600);

    expect(observer).toHaveBeenCalledWith(
      "OnCursorUpdated",
      expect.arrayContaining([DEMO_COLLABORATOR.id]),
    );
    expect(observer).toHaveBeenCalledWith("OnActivityCreated", [
      expect.objectContaining({ name: "흑돼지거리", parentPathId: "day-three" }),
    ]);
    expect(findNode(server.getSnapshot().nodes, "demo-collaborator-black-pork")).toBeDefined();

    await vi.advanceTimersByTimeAsync(100);
    expect(server.getSnapshot().messages.at(-1)).toMatchObject({
      memberId: DEMO_COLLABORATOR.id,
      memberName: DEMO_COLLABORATOR.name,
    });

    await vi.advanceTimersByTimeAsync(1_000);
    expect(findNode(server.getSnapshot().nodes, "day-three-dongmun")?.name).toBe("동문시장 야시장");

    collaborator.stop();
  });

  it("toggles its edits back so two rounds leave the schedule as it was", async () => {
    const { collaborator, observer, observerConnection, server } = setup();
    await observerConnection.invoke("JoinProject", [DEMO_PROJECT_ID]);
    const initialNodes = server.getSnapshot().nodes;
    const countPlannerEdits = () =>
      observer.mock.calls.filter(([eventName]) => /^On(Activity|Path|Node)/.test(eventName)).length;

    collaborator.start();
    while (countPlannerEdits() < 8) {
      await vi.advanceTimersByTimeAsync(100);
    }
    collaborator.stop();

    const nodes = server.getSnapshot().nodes;
    expect(nodes).toHaveLength(initialNodes.length);
    ["day-three-dongmun", "day-seven-seongsan", "day-four-camellia"].forEach((pathId) => {
      expect(findNode(nodes, pathId)).toEqual(findNode(initialNodes, pathId));
    });
  });

  it("skips nodes the user is working on", async () => {
    const { collaborator, server } = setup({
      canTouch: (node) => node.pathId !== "day-three",
    });

    collaborator.start();
    await vi.advanceTimersByTimeAsync(600);
    collaborator.stop();

    expect(findNode(server.getSnapshot().nodes, "demo-collaborator-black-pork")).toBeUndefined();
    expect(findNode(server.getSnapshot().nodes, "day-three-dongmun")?.name).toBe("동문시장 야시장");
  });

  it("waits while the user holds the pointer and stops cleanly", async () => {
    let isHolding = true;
    const { collaborator, server } = setup({ shouldHold: () => isHolding });
    const initialNodes = server.getSnapshot().nodes;

    collaborator.start();
    await vi.advanceTimersByTimeAsync(3_000);
    expect(server.getSnapshot().nodes).toBe(initialNodes);

    isHolding = false;
    await vi.advanceTimersByTimeAsync(1_000);
    expect(server.getSnapshot().nodes).not.toBe(initialNodes);

    collaborator.stop();
    const stoppedNodes = server.getSnapshot().nodes;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(server.getSnapshot().nodes).toBe(stoppedNodes);
    expect(collaborator.isRunning()).toBe(false);
  });
});
