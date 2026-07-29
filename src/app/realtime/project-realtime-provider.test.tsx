import { describe, expect, it, vi } from "vitest";

import {
  ProjectRealtimeProvider,
  ProjectRealtimeStatusBanner,
} from "@/app/realtime/project-realtime-provider";
import type { SignalRClient, SignalRConnectionStatus } from "@/lib/signalr-client";
import { render, screen, userEvent, waitFor } from "@/testing/test-utils";

function createFakeClient() {
  const listeners = new Set<(status: SignalRConnectionStatus) => void>();
  let status: SignalRConnectionStatus = "idle";
  const invokeMock = vi.fn().mockResolvedValue(undefined);
  const startMock = vi.fn(async () => {
    if (status === "connected") {
      return;
    }

    emit("connecting");
    emit("connected");
  });
  const stopMock = vi.fn(async () => {
    emit("idle");
  });
  const client: SignalRClient = {
    getStatus: () => status,
    invoke: invokeMock as SignalRClient["invoke"],
    on: vi.fn(() => () => undefined),
    start: startMock,
    stop: stopMock,
    subscribeStatus(listener) {
      listeners.add(listener);
      listener(status);
      return () => listeners.delete(listener);
    },
  };

  function emit(nextStatus: SignalRConnectionStatus): void {
    status = nextStatus;
    listeners.forEach((listener) => listener(status));
  }

  return { client, emit, invokeMock, startMock, stopMock };
}

describe("ProjectRealtimeProvider", () => {
  it("stops the old connection and creates a new session when the project changes", async () => {
    const first = createFakeClient();
    const second = createFakeClient();
    const clientFactory = vi
      .fn()
      .mockReturnValueOnce(first.client)
      .mockReturnValueOnce(second.client);
    const registerSubscriptions = vi.fn();
    const resync = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <ProjectRealtimeProvider
        clientFactory={clientFactory}
        projectId="first-project"
        registerSubscriptions={registerSubscriptions}
        resync={resync}
      >
        <ProjectRealtimeStatusBanner />
      </ProjectRealtimeProvider>,
    );
    await waitFor(() =>
      expect(first.invokeMock).toHaveBeenCalledWith("JoinProject", "first-project"),
    );

    rerender(
      <ProjectRealtimeProvider
        clientFactory={clientFactory}
        projectId="second-project"
        registerSubscriptions={registerSubscriptions}
        resync={resync}
      >
        <ProjectRealtimeStatusBanner />
      </ProjectRealtimeProvider>,
    );

    await waitFor(() => expect(first.stopMock).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(second.invokeMock).toHaveBeenCalledWith("JoinProject", "second-project"),
    );
    expect(clientFactory).toHaveBeenCalledTimes(2);
  });

  it("shows a retry action after disconnect and resyncs the joined project", async () => {
    const fake = createFakeClient();
    const resync = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <ProjectRealtimeProvider
        clientFactory={() => fake.client}
        projectId="project-id"
        registerSubscriptions={vi.fn()}
        resync={resync}
      >
        <ProjectRealtimeStatusBanner />
      </ProjectRealtimeProvider>,
    );
    await waitFor(() => expect(fake.invokeMock).toHaveBeenCalledTimes(1));

    fake.emit("disconnected");
    await user.click(await screen.findByRole("button", { name: "다시 연결" }));

    await waitFor(() => expect(fake.invokeMock).toHaveBeenCalledTimes(2));
    expect(fake.startMock).toHaveBeenCalledTimes(2);
    expect(resync).toHaveBeenCalledTimes(1);
  });
});
