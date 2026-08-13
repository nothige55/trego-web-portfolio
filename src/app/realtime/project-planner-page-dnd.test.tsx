import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProjectPlannerPage } from "@/app/realtime/project-planner-page";
import type {
  PlannerNodeEditingCommands,
  PlannerNodeMoveHandler,
} from "@/features/planner/components/planner-schedule-panel";
import { usePlannerViewStore } from "@/features/planner/stores/planner-view-store";
import type { ApiClient } from "@/lib/api-client";
import type { SignalRClient, SignalRConnectionStatus } from "@/lib/signalr-client";
import { fireEvent, render, screen, userEvent, waitFor } from "@/testing/test-utils";

vi.mock("@/features/planner/components/planner-workspace", () => ({
  PlannerWorkspace: ({
    isNodeMoveEnabled,
    onMoveNode,
    plannerCommands,
  }: {
    isNodeMoveEnabled: boolean;
    onMoveNode: PlannerNodeMoveHandler;
    plannerCommands?: PlannerNodeEditingCommands;
  }) => (
    <>
      <button
        type="button"
        disabled={!isNodeMoveEnabled}
        onClick={() =>
          onMoveNode("activity-path", {
            parentPathId: "target-day-path",
            siblingIndex: 0,
            position: 0.1,
          })
        }
      >
        일정 이동
      </button>
      <button
        type="button"
        disabled={!plannerCommands}
        onClick={() =>
          void plannerCommands?.updateDay({
            id: "source-day-id",
            name: "Renamed source",
            color: "#123456",
          })
        }
      >
        Day 수정
      </button>
      <button
        type="button"
        disabled={!plannerCommands}
        onClick={() => void plannerCommands?.deleteNode({ pathId: "source-day-path" })}
      >
        Day 삭제
      </button>
      <button
        type="button"
        disabled={!plannerCommands?.undo}
        onClick={() => void plannerCommands?.undo?.()}
      >
        실행 취소
      </button>
    </>
  ),
}));

function createSignalRClient(updatePathImplementation?: () => Promise<void>) {
  const statusListeners = new Set<(status: SignalRConnectionStatus) => void>();
  const eventHandlers = new Map<string, Set<(...args: readonly unknown[]) => void>>();
  let status: SignalRConnectionStatus = "idle";
  let resolveMove = () => {};
  const pendingMove = new Promise<void>((resolve) => {
    resolveMove = resolve;
  });
  const invoke = vi.fn((methodName: string) => {
    if (methodName !== "UpdatePath") {
      return Promise.resolve();
    }

    return updatePathImplementation ? updatePathImplementation() : pendingMove;
  });
  const client: SignalRClient = {
    getStatus: () => status,
    invoke: invoke as SignalRClient["invoke"],
    on(eventName, handler) {
      const handlers = eventHandlers.get(eventName) ?? new Set();
      handlers.add(handler as (...args: readonly unknown[]) => void);
      eventHandlers.set(eventName, handlers);
      return () => handlers.delete(handler as (...args: readonly unknown[]) => void);
    },
    async start() {
      status = "connecting";
      statusListeners.forEach((listener) => listener(status));
      status = "connected";
      statusListeners.forEach((listener) => listener(status));
    },
    async stop() {
      status = "idle";
      statusListeners.forEach((listener) => listener(status));
    },
    subscribeStatus(listener) {
      statusListeners.add(listener);
      listener(status);
      return () => statusListeners.delete(listener);
    },
  };

  return { client, invoke, resolveMove };
}

function createRestClient() {
  const get = vi.fn(async (url: string) => {
    if (url.endsWith("/nodes")) {
      return [
        {
          kind: "folder",
          id: "root-id",
          name: "Live project",
          folderType: "root",
          pathId: "root-path",
          parentPathId: null,
          position: 0,
        },
        {
          kind: "day",
          id: "source-day-id",
          name: "Source",
          color: "#ff0000",
          pathId: "source-day-path",
          parentPathId: "root-path",
          position: 0.1,
        },
        {
          kind: "activity",
          id: "activity-id",
          name: "Move me",
          activityType: "single",
          memo: null,
          markerType: null,
          travelMode: null,
          travelTime: null,
          travelDistance: null,
          travelCost: null,
          startTime: null,
          endTime: null,
          placeId: null,
          latitude: null,
          longitude: null,
          googlePlaceId: null,
          pathId: "activity-path",
          parentPathId: "source-day-path",
          position: 0.1,
        },
        {
          kind: "day",
          id: "target-day-id",
          name: "Target",
          color: "#00ff00",
          pathId: "target-day-path",
          parentPathId: "root-path",
          position: 0.2,
        },
      ];
    }

    if (url.endsWith("/messages")) {
      return [];
    }

    return {
      publicId: "project-id",
      title: "Live project",
      startDate: "2026-08-01T00:00:00Z",
      endDate: "2026-08-03T00:00:00Z",
      isPublic: false,
    };
  });

  return { client: { get } as unknown as ApiClient, get };
}

describe("ProjectPlannerPage DnD realtime", () => {
  afterEach(() => {
    usePlannerViewStore.getState().reset();
  });

  it("moves the canonical nodes locally, invokes UpdatePath once, and blocks another move while pending", async () => {
    const signalR = createSignalRClient();
    const user = userEvent.setup();
    render(
      <ProjectPlannerPage
        clientFactory={() => signalR.client}
        identity={{
          accessToken: "token",
          email: "one@example.com",
          id: "member-id",
          name: "One",
        }}
        projectId="project-id"
        restClient={createRestClient().client}
      />,
    );

    const moveButton = await screen.findByRole("button", { name: "일정 이동" });
    await waitFor(() => expect(moveButton).toBeEnabled());
    await user.click(moveButton);

    expect(
      usePlannerViewStore.getState().nodes.find((node) => node.pathId === "activity-path"),
    ).toMatchObject({
      parentPathId: "target-day-path",
      position: 0.1,
    });
    expect(signalR.invoke).toHaveBeenCalledWith("UpdatePath", {
      pathId: "activity-path",
      parentPathId: "target-day-path",
      position: 0.1,
    });
    expect(
      signalR.invoke.mock.calls.filter(([methodName]) => methodName === "UpdatePath"),
    ).toHaveLength(1);
    expect(moveButton).toBeDisabled();

    await act(async () => {
      signalR.resolveMove();
      await Promise.resolve();
    });
    await waitFor(() => expect(moveButton).toBeEnabled());
  });

  it("restores the canonical REST position when UpdatePath fails", async () => {
    const signalR = createSignalRClient(() => Promise.reject(new Error("move failed")));
    const rest = createRestClient();
    render(
      <ProjectPlannerPage
        clientFactory={() => signalR.client}
        identity={{
          accessToken: "token",
          email: "one@example.com",
          id: "member-id",
          name: "One",
        }}
        projectId="project-id"
        restClient={rest.client}
      />,
    );

    const moveButton = await screen.findByRole("button", { name: "일정 이동" });
    await waitFor(() => expect(moveButton).toBeEnabled());
    const nodeRequestCountBeforeMove = rest.get.mock.calls.filter(([url]) =>
      String(url).endsWith("/nodes"),
    ).length;

    fireEvent.click(moveButton);
    expect(
      usePlannerViewStore.getState().nodes.find((node) => node.pathId === "activity-path"),
    ).toMatchObject({
      parentPathId: "target-day-path",
      position: 0.1,
    });

    await waitFor(() =>
      expect(rest.get.mock.calls.filter(([url]) => String(url).endsWith("/nodes"))).toHaveLength(
        nodeRequestCountBeforeMove + 1,
      ),
    );
    await waitFor(() =>
      expect(
        usePlannerViewStore.getState().nodes.find((node) => node.pathId === "activity-path"),
      ).toMatchObject({
        parentPathId: "source-day-path",
        position: 0.1,
      }),
    );
    expect(await screen.findByText("move failed")).toBeInTheDocument();
    expect(
      signalR.invoke.mock.calls.filter(([methodName]) => methodName === "UpdatePath"),
    ).toHaveLength(1);
  });

  it("shares the connected planner adapter with node editing commands", async () => {
    const signalR = createSignalRClient();
    const user = userEvent.setup();
    render(
      <ProjectPlannerPage
        clientFactory={() => signalR.client}
        identity={{
          accessToken: "token",
          email: "one@example.com",
          id: "member-id",
          name: "One",
        }}
        projectId="project-id"
        restClient={createRestClient().client}
      />,
    );

    const updateButton = await screen.findByRole("button", { name: "Day 수정" });
    const deleteButton = screen.getByRole("button", { name: "Day 삭제" });
    await waitFor(() => expect(updateButton).toBeEnabled());
    expect(deleteButton).toBeEnabled();

    await user.click(updateButton);
    expect(signalR.invoke).toHaveBeenCalledWith("UpdateDay", {
      id: "source-day-id",
      name: "Renamed source",
      color: "#123456",
    });
    expect(
      usePlannerViewStore.getState().nodes.find((node) => node.pathId === "source-day-path"),
    ).toMatchObject({ name: "Renamed source", color: "#123456" });

    await user.click(deleteButton);
    expect(signalR.invoke).toHaveBeenCalledWith("DeleteNode", { pathId: "source-day-path" });
    expect(
      usePlannerViewStore.getState().nodes.find((node) => node.pathId === "source-day-path"),
    ).toBeUndefined();
  });

  it("records a confirmed edit and replays its inverse through the same SignalR adapter", async () => {
    const signalR = createSignalRClient();
    const user = userEvent.setup();
    render(
      <ProjectPlannerPage
        clientFactory={() => signalR.client}
        identity={{
          accessToken: "token",
          email: "one@example.com",
          id: "member-id",
          name: "One",
        }}
        projectId="project-id"
        restClient={createRestClient().client}
      />,
    );

    const updateButton = await screen.findByRole("button", { name: "Day 수정" });
    const undoButton = screen.getByRole("button", { name: "실행 취소" });
    await waitFor(() => expect(updateButton).toBeEnabled());
    await user.click(updateButton);
    await user.click(undoButton);

    await waitFor(() =>
      expect(signalR.invoke).toHaveBeenLastCalledWith("UpdateDay", {
        id: "source-day-id",
        name: "Source",
        color: "#ff0000",
      }),
    );
    expect(
      usePlannerViewStore.getState().nodes.find((node) => node.pathId === "source-day-path"),
    ).toMatchObject({ name: "Source", color: "#ff0000" });
  });
});
