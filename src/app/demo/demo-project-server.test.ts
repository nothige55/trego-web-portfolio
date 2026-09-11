import { describe, expect, it, vi } from "vitest";

import { createDemoProjectServer } from "@/app/demo/demo-project-server";
import { createDemoProjectSeed, DEMO_MEMBERS, DEMO_PROJECT_ID } from "@/app/demo/demo-seed";
import { EMPTY_GUID } from "@/features/planner/realtime/project-hub-planner-contracts";

function createServer() {
  return createDemoProjectServer({
    latencyMs: 0,
    members: DEMO_MEMBERS,
    now: () => Date.parse("2026-09-10T09:00:00Z"),
    seed: createDemoProjectSeed(Date.parse("2026-09-10T08:00:00Z")),
  });
}

async function connectAndJoin(server: ReturnType<typeof createServer>) {
  const listener = vi.fn();
  const connection = server.connect(listener);
  await connection.invoke("JoinProject", [DEMO_PROJECT_ID]);
  return { connection, listener };
}

describe("createDemoProjectServer", () => {
  it("echoes planner commands to every joined connection, including the sender", async () => {
    const server = createServer();
    const sender = await connectAndJoin(server);
    const other = await connectAndJoin(server);
    const notJoinedListener = vi.fn();
    server.connect(notJoinedListener);
    const request = { pathId: "day-three-dongmun", parentPathId: "day-four", position: 9 };

    await sender.connection.invoke("UpdatePath", [request]);

    expect(sender.listener).toHaveBeenCalledWith("OnPathUpdated", [request]);
    expect(other.listener).toHaveBeenCalledWith("OnPathUpdated", [request]);
    expect(notJoinedListener).not.toHaveBeenCalled();
    expect(
      server.getSnapshot().nodes.find((node) => node.pathId === "day-three-dongmun"),
    ).toMatchObject({ parentPathId: "day-four", position: 9 });
  });

  it("keeps the canonical nodes consistent with the Hub root convention", async () => {
    const server = createServer();
    const { connection } = await connectAndJoin(server);

    await connection.invoke("CreateFolder", [
      {
        id: "folder-entity",
        name: "새 폴더",
        pathId: "new-folder",
        parentPathId: EMPTY_GUID,
        position: 10,
        type: "default",
      },
    ]);

    expect(server.getSnapshot().nodes.find((node) => node.pathId === "new-folder")).toMatchObject({
      kind: "folder",
      parentPathId: null,
    });
  });

  it("drops events for closed connections instead of queueing them", async () => {
    const server = createServer();
    const offline = await connectAndJoin(server);
    const online = await connectAndJoin(server);
    offline.connection.close();

    await online.connection.invoke("DeleteNode", [{ pathId: "day-three-dongmun" }]);
    await expect(offline.connection.invoke("DeleteNode", [{ pathId: "x" }])).rejects.toThrow(
      "데모 서버와의 연결이 끊겼습니다.",
    );

    expect(offline.listener).not.toHaveBeenCalled();
    expect(online.listener).toHaveBeenCalledWith("OnNodeDeleted", [
      { pathId: "day-three-dongmun" },
    ]);
  });

  it("stamps chat messages and sends cursor updates only to other members", async () => {
    const server = createServer();
    const me = await connectAndJoin(server);
    const minji = await connectAndJoin(server);

    await minji.connection.invoke("SendMessage", [
      { MemberId: "minji", ProjectId: DEMO_PROJECT_ID, Content: "안녕하세요", Type: "member" },
    ]);
    await minji.connection.invoke("UpdateCursor", ["minji", 0.2, 0.4]);

    const message = {
      messageId: 3,
      memberId: "minji",
      memberName: "민지",
      content: "안녕하세요",
      type: "member",
      createdAt: "2026-09-10T09:00:00.000Z",
      projectId: DEMO_PROJECT_ID,
    };
    expect(me.listener).toHaveBeenCalledWith("OnMessageReceived", [message]);
    expect(minji.listener).toHaveBeenCalledWith("OnMessageReceived", [message]);
    expect(server.getSnapshot().messages.at(-1)).toEqual(message);
    expect(me.listener).toHaveBeenCalledWith("OnCursorUpdated", ["minji", 0.2, 0.4]);
    expect(minji.listener).not.toHaveBeenCalledWith("OnCursorUpdated", expect.anything());
  });

  it("rejects unknown projects and methods like a Hub exception", async () => {
    const server = createServer();
    const connection = server.connect(vi.fn());

    await expect(connection.invoke("JoinProject", ["other-project"])).rejects.toThrow(
      "프로젝트를 찾을 수 없습니다.",
    );
    await expect(connection.invoke("DropDatabase", [])).rejects.toThrow(
      "알 수 없는 Hub 메서드입니다: DropDatabase",
    );
  });

  it("hides fixture nodes that only exist for drop-rule tests", () => {
    const pathIds = createServer()
      .getSnapshot()
      .nodes.map((node) => node.pathId);

    expect(pathIds).toContain("day-three");
    expect(pathIds).not.toContain("dnd-test-day");
    expect(pathIds).not.toContain("dnd-empty-group");
    expect(pathIds).not.toContain("empty-wish");
  });
});
