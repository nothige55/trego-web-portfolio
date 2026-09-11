import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProjectPlannerPage } from "@/app/realtime/project-planner-page";
import { usePlannerViewStore } from "@/features/planner/stores/planner-view-store";
import type { ApiClient } from "@/lib/api-client";
import type { SignalRClient, SignalRConnectionStatus } from "@/lib/signalr-client";
import { act, fireEvent, render, screen, userEvent, waitFor, within } from "@/testing/test-utils";

vi.mock("@/features/planner/components/planner-map", () => ({
  PlannerMap: () => <section aria-label="지도 영역" />,
}));

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

  return { client, emit, invoke, setStatus };
}

function createRestClient() {
  const get = vi.fn(async (url: string): Promise<unknown> => {
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

describe("ProjectPlannerPage", () => {
  afterEach(() => {
    usePlannerViewStore.getState().reset();
  });

  it("joins, resyncs REST data, and exposes live chat and cursor behavior", async () => {
    const signalR = createFakeSignalRClient();
    const rest = createRestClient();
    const user = userEvent.setup();
    render(
      <ProjectPlannerPage
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

    expect(screen.getByRole("status")).toHaveTextContent("여행 일정 데이터를 불러오는 중입니다.");
    expect(screen.queryByRole("heading", { name: "제주도 7일 여행" })).not.toBeInTheDocument();
    await screen.findByRole("heading", { name: "Live project" });
    expect(signalR.invoke).toHaveBeenCalledWith(
      "JoinProject",
      "33333333-3333-3333-3333-333333333333",
    );
    expect(rest.get).toHaveBeenCalledWith(
      "/api/projects/33333333-3333-3333-3333-333333333333/messages",
    );
    expect(rest.get).toHaveBeenCalledWith("/api/projects/33333333-3333-3333-3333-333333333333");
    expect(rest.get).toHaveBeenCalledWith(
      "/api/v2/projects/33333333-3333-3333-3333-333333333333/nodes",
    );
    expect(screen.getByText("아직 등록된 일정이 없습니다.")).toBeInTheDocument();

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

  it("adds an explored place under the chosen day and records it for undo", async () => {
    const signalR = createFakeSignalRClient();
    const rest = createRestClient();
    const respondWithDefaultData = rest.get.getMockImplementation()!;
    const dayPathId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
    rest.get.mockImplementation(async (url: string) =>
      url.endsWith("/nodes")
        ? [
            ...((await respondWithDefaultData(url)) as readonly unknown[]),
            {
              kind: "day",
              id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
              name: "8월 1일",
              color: "#F44336",
              pathId: dayPathId,
              parentPathId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
              position: 0.1,
            },
          ]
        : respondWithDefaultData(url),
    );
    const user = userEvent.setup();
    render(
      <ProjectPlannerPage
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

    await user.click(screen.getByRole("button", { name: /성산일출봉/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: "일정에 추가" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "일정에 추가" }));
    const dayTargets = await screen.findByRole("group", { name: "날짜" });
    await user.click(within(dayTargets).getByRole("button", { name: "8월 1일" }));

    expect(await screen.findByText("8월 1일에 추가했습니다.")).toBeInTheDocument();
    expect(signalR.invoke).toHaveBeenCalledWith(
      "CreateActivity",
      expect.objectContaining({
        name: "성산일출봉",
        lat: 33.4581,
        lng: 126.9425,
        parentPathId: dayPathId,
        type: "single",
      }),
    );
    const tree = screen.getByRole("tree");
    const addedRow = within(tree).getByText("성산일출봉").closest("[role=treeitem]");
    expect(addedRow).toHaveAttribute("aria-selected", "true");

    const created = signalR.invoke.mock.calls.find(([method]) => method === "CreateActivity")!;
    await user.click(screen.getByRole("button", { name: "실행 취소" }));
    expect(signalR.invoke).toHaveBeenCalledWith("DeleteNode", {
      pathId: (created[1] as { pathId: string }).pathId,
    });
    await waitFor(() => expect(within(tree).queryByText("성산일출봉")).not.toBeInTheDocument());
  });

  it("loads REST chat history even when the realtime connection fails", async () => {
    const signalR = createFakeSignalRClient();
    signalR.client.start = vi.fn().mockRejectedValue(new Error("offline"));
    const rest = createRestClient();

    render(
      <ProjectPlannerPage
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

    await userEvent.setup().click(await screen.findByRole("button", { name: "채팅" }));

    expect(await screen.findByText("REST history")).toBeInTheDocument();
    expect(rest.get).toHaveBeenCalledWith(
      "/api/projects/33333333-3333-3333-3333-333333333333/messages",
    );
  });

  it("finishes the real project load under React StrictMode", async () => {
    const signalR = createFakeSignalRClient();
    const rest = createRestClient();

    render(
      <StrictMode>
        <ProjectPlannerPage
          clientFactory={() => signalR.client}
          identity={{
            accessToken: "token",
            email: "one@example.com",
            id: "11111111-1111-1111-1111-111111111111",
            name: "One",
          }}
          projectId="33333333-3333-3333-3333-333333333333"
          restClient={rest.client}
        />
      </StrictMode>,
    );

    expect(await screen.findByRole("heading", { name: "Live project" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "제주도 7일 여행" })).not.toBeInTheDocument();
  });

  it("keeps the planner workspace mounted while resyncing after a reconnect", async () => {
    const signalR = createFakeSignalRClient();
    const rest = createRestClient();
    render(
      <ProjectPlannerPage
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
    const workspace = screen.getByRole("main", { name: "여행 일정 플래너" });

    const respondWithDefaultData = rest.get.getMockImplementation()!;
    let resolveProjectDetails!: (details: unknown) => void;
    rest.get.mockImplementation((url: string) =>
      url.endsWith("/projects/33333333-3333-3333-3333-333333333333")
        ? new Promise((resolve) => {
            resolveProjectDetails = resolve;
          })
        : respondWithDefaultData(url),
    );
    act(() => {
      signalR.setStatus("reconnecting");
      signalR.setStatus("connected");
    });

    expect(await screen.findByText("실시간 연결 중입니다.")).toBeInTheDocument();
    expect(screen.getByRole("main", { name: "여행 일정 플래너" })).toBe(workspace);
    expect(screen.queryByText("여행 일정 데이터를 불러오는 중입니다.")).not.toBeInTheDocument();

    act(() => {
      resolveProjectDetails({
        publicId: "33333333-3333-3333-3333-333333333333",
        title: "Resynced project",
        startDate: "2026-08-01T00:00:00Z",
        endDate: "2026-08-03T00:00:00Z",
        isPublic: false,
      });
    });

    expect(await screen.findByRole("heading", { name: "Resynced project" })).toBeInTheDocument();
    expect(screen.getByRole("main", { name: "여행 일정 플래너" })).toBe(workspace);
    await waitFor(() =>
      expect(screen.queryByText("실시간 연결 중입니다.")).not.toBeInTheDocument(),
    );
  });

  it("keeps stale planner data and shows the banner when a reconnect resync fails", async () => {
    const signalR = createFakeSignalRClient();
    const rest = createRestClient();
    render(
      <ProjectPlannerPage
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
    const workspace = screen.getByRole("main", { name: "여행 일정 플래너" });

    const respondWithDefaultData = rest.get.getMockImplementation()!;
    rest.get.mockImplementation((url: string) =>
      url.endsWith("/nodes")
        ? Promise.reject(new Error("resync failed"))
        : respondWithDefaultData(url),
    );
    act(() => {
      signalR.setStatus("reconnecting");
      signalR.setStatus("connected");
    });

    expect(await screen.findByText("실시간 동기화에 실패했습니다.")).toBeInTheDocument();
    expect(screen.getByText("resync failed")).toBeInTheDocument();
    expect(screen.getByRole("main", { name: "여행 일정 플래너" })).toBe(workspace);
    expect(screen.getByRole("heading", { name: "Live project" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "여행 일정을 불러오지 못했습니다." }),
    ).not.toBeInTheDocument();

    rest.get.mockImplementation(respondWithDefaultData);
    await userEvent.setup().click(screen.getByRole("button", { name: "다시 연결" }));

    await waitFor(() =>
      expect(screen.queryByText("실시간 동기화에 실패했습니다.")).not.toBeInTheDocument(),
    );
    expect(screen.queryByText("resync failed")).not.toBeInTheDocument();
    expect(screen.getByRole("main", { name: "여행 일정 플래너" })).toBe(workspace);
  });

  it("shows the project REST error without falling back to fixture data", async () => {
    const signalR = createFakeSignalRClient();
    const get = vi.fn(async (url: string) => {
      if (url.endsWith("/messages")) {
        return [];
      }

      throw new Error("project REST failed");
    });

    render(
      <ProjectPlannerPage
        clientFactory={() => signalR.client}
        identity={{
          accessToken: "token",
          email: "one@example.com",
          id: "11111111-1111-1111-1111-111111111111",
          name: "One",
        }}
        projectId="33333333-3333-3333-3333-333333333333"
        restClient={{ get } as unknown as ApiClient}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: "여행 일정을 불러오지 못했습니다." }),
    ).toBeInTheDocument();
    expect(screen.getByText("project REST failed")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "제주도 7일 여행" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 연결" })).toBeInTheDocument();
  });
});
