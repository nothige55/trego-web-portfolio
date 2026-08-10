import { afterEach, describe, expect, it, vi } from "vitest";

import { PlannerRealtimeDemo } from "@/app/realtime/planner-realtime-demo";
import { usePlannerViewStore } from "@/features/planner/stores/planner-view-store";
import type { ApiClient } from "@/lib/api-client";
import type { SignalRClient, SignalRConnectionStatus } from "@/lib/signalr-client";
import { fireEvent, render, screen, userEvent, waitFor } from "@/testing/test-utils";

function createFakeSignalRClient() {
  const statusListeners = new Set<(status: SignalRConnectionStatus) => void>();
  const eventHandlers = new Map<string, Set<(...args: readonly unknown[]) => void>>();
  let status: SignalRConnectionStatus = "idle";
  const invoke = vi.fn().mockResolvedValue(undefined);
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
      setStatus("connecting");
      setStatus("connected");
    },
    async stop() {
      setStatus("idle");
    },
    subscribeStatus(listener) {
      statusListeners.add(listener);
      listener(status);
      return () => statusListeners.delete(listener);
    },
  };

  function setStatus(nextStatus: SignalRConnectionStatus) {
    status = nextStatus;
    statusListeners.forEach((listener) => listener(status));
  }

  function emit(eventName: string, ...args: readonly unknown[]) {
    eventHandlers.get(eventName)?.forEach((handler) => handler(...args));
  }

  return { client, emit, invoke };
}

function createRestClient() {
  const get = vi.fn(async (url: string) => {
    if (url.endsWith("/nodes")) {
      return [
        {
          kind: "folder",
          id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          name: "Live project",
          folderType: "root",
          pathId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
          parentPathId: null,
          position: 0,
        },
      ];
    }

    if (url.endsWith("/messages")) {
      return [
        {
          messageId: 1,
          memberId: "22222222-2222-2222-2222-222222222222",
          content: "REST history",
          type: "member",
          createdAt: "2026-07-31T10:00:00Z",
        },
      ];
    }

    return {
      publicId: "33333333-3333-3333-3333-333333333333",
      title: "Live project",
      startDate: "2026-08-01T00:00:00Z",
      endDate: "2026-08-03T00:00:00Z",
      isPublic: false,
    };
  });

  return { client: { get } as unknown as ApiClient, get };
}

describe("PlannerRealtimeDemo", () => {
  afterEach(() => {
    usePlannerViewStore.getState().reset();
  });

  it("joins, resyncs REST data, and exposes live chat and cursor behavior", async () => {
    const signalR = createFakeSignalRClient();
    const rest = createRestClient();
    const user = userEvent.setup();
    render(
      <PlannerRealtimeDemo
        clientFactory={() => signalR.client}
        identity={{
          accessToken: "token",
          email: "one@example.com",
          id: "11111111-1111-1111-1111-111111111111",
          name: "One",
        }}
        projectId="33333333-3333-3333-3333-333333333333"
        restClient={rest.client}
      />,
    );

    await screen.findByRole("heading", { name: "Live project" });
    expect(signalR.invoke).toHaveBeenCalledWith(
      "JoinProject",
      "33333333-3333-3333-3333-333333333333",
    );
    expect(rest.get).toHaveBeenCalledWith(
      "/api/projects/33333333-3333-3333-3333-333333333333/messages",
    );

    await user.click(screen.getByRole("button", { name: "채팅" }));
    expect(await screen.findByText("REST history")).toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: "채팅 메시지" }), "SignalR message");
    await user.click(screen.getByRole("button", { name: "메시지 보내기" }));
    expect(signalR.invoke).toHaveBeenCalledWith("SendMessage", {
      MemberId: "11111111-1111-1111-1111-111111111111",
      ProjectId: "33333333-3333-3333-3333-333333333333",
      Content: "SignalR message",
      Type: "member",
    });

    signalR.emit("OnMessageReceived", {
      messageId: 2,
      memberId: "11111111-1111-1111-1111-111111111111",
      projectId: "33333333-3333-3333-3333-333333333333",
      content: "SignalR message",
      type: "member",
      createdAt: "2026-07-31T10:01:00Z",
    });
    expect(await screen.findByText("SignalR message")).toBeInTheDocument();

    signalR.emit("OnCursorUpdated", "22222222-2222-2222-2222-222222222222", 0.25, 0.75);
    const remoteCursor = await screen.findByTestId(
      "remote-cursor-22222222-2222-2222-2222-222222222222",
    );
    expect(remoteCursor).toHaveStyle({ left: "25%", top: "75%" });

    const surface = screen.getByTestId("cursor-presence-surface");
    surface.getBoundingClientRect = () =>
      ({ left: 10, top: 20, width: 100, height: 200 }) as DOMRect;
    fireEvent.pointerMove(surface, { clientX: 60, clientY: 120 });
    await waitFor(() =>
      expect(signalR.invoke).toHaveBeenCalledWith(
        "UpdateCursor",
        "11111111-1111-1111-1111-111111111111",
        0.5,
        0.5,
      ),
    );
  });

  it("loads REST chat history even when the realtime connection fails", async () => {
    const signalR = createFakeSignalRClient();
    signalR.client.start = vi.fn().mockRejectedValue(new Error("offline"));
    const rest = createRestClient();

    render(
      <PlannerRealtimeDemo
        clientFactory={() => signalR.client}
        identity={{
          accessToken: "token",
          email: "one@example.com",
          id: "11111111-1111-1111-1111-111111111111",
          name: "One",
        }}
        projectId="33333333-3333-3333-3333-333333333333"
        restClient={rest.client}
      />,
    );

    await userEvent.setup().click(screen.getByRole("button", { name: "채팅" }));

    expect(await screen.findByText("REST history")).toBeInTheDocument();
    expect(rest.get).toHaveBeenCalledWith(
      "/api/projects/33333333-3333-3333-3333-333333333333/messages",
    );
  });
});
