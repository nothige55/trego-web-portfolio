import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDemoNetwork } from "@/app/demo/demo-network";
import { createDemoProjectServer } from "@/app/demo/demo-project-server";
import { createDemoProjectSeed, DEMO_MEMBERS, DEMO_PROJECT_ID } from "@/app/demo/demo-seed";
import { createDemoSignalRClient } from "@/app/demo/demo-signalr-client";
import { SignalRNotConnectedError } from "@/lib/signalr-client";

const RENAME_REQUEST = { id: "demo-day-three-dongmun", name: "야시장" };

function setup() {
  const network = createDemoNetwork();
  const server = createDemoProjectServer({
    latencyMs: 0,
    members: DEMO_MEMBERS,
    seed: createDemoProjectSeed(),
  });
  const client = createDemoSignalRClient({
    connectDelayMs: 10,
    network,
    reconnectDelayMs: 50,
    server,
  });
  const statuses: string[] = [];
  client.subscribeStatus((status) => statuses.push(status));

  return { client, network, server, statuses };
}

describe("createDemoSignalRClient", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("connects like a SignalR client and receives its own echo", async () => {
    const { client, statuses } = setup();
    const onUpdated = vi.fn();
    client.on("OnActivityUpdated", onUpdated);

    const started = client.start();
    await vi.advanceTimersByTimeAsync(10);
    await started;
    await client.invoke("JoinProject", DEMO_PROJECT_ID);
    await client.invoke("UpdateActivity", RENAME_REQUEST);

    expect(statuses).toEqual(["idle", "connecting", "connected"]);
    expect(onUpdated).toHaveBeenCalledWith(RENAME_REQUEST);
  });

  it("misses events while offline and needs to rejoin after reconnecting", async () => {
    const { client, network, server, statuses } = setup();
    const onUpdated = vi.fn();
    client.on("OnActivityUpdated", onUpdated);
    const started = client.start();
    await vi.advanceTimersByTimeAsync(10);
    await started;
    await client.invoke("JoinProject", DEMO_PROJECT_ID);
    const collaborator = server.connect(vi.fn());
    await collaborator.invoke("JoinProject", [DEMO_PROJECT_ID]);

    network.setOnline(false);
    await expect(client.invoke("UpdateActivity", RENAME_REQUEST)).rejects.toBeInstanceOf(
      SignalRNotConnectedError,
    );
    await collaborator.invoke("UpdateActivity", [RENAME_REQUEST]);
    network.setOnline(true);
    await vi.advanceTimersByTimeAsync(50);

    expect(statuses).toEqual(["idle", "connecting", "connected", "reconnecting", "connected"]);
    expect(onUpdated).not.toHaveBeenCalled();

    await collaborator.invoke("UpdateActivity", [RENAME_REQUEST]);
    expect(onUpdated).not.toHaveBeenCalled();

    await client.invoke("JoinProject", DEMO_PROJECT_ID);
    await collaborator.invoke("UpdateActivity", [RENAME_REQUEST]);
    expect(onUpdated).toHaveBeenCalledTimes(1);
  });

  it("fails the initial connection while the network is off", async () => {
    const { client, network, statuses } = setup();
    network.setOnline(false);

    const started = client.start();
    const assertion = expect(started).rejects.toThrow("데모 서버에 연결하지 못했습니다.");
    await vi.advanceTimersByTimeAsync(10);
    await assertion;

    expect(statuses.at(-1)).toBe("disconnected");
  });

  it("cancels a pending start when stopped, as StrictMode does", async () => {
    const { client, statuses } = setup();

    const firstStart = client.start();
    const cancelled = expect(firstStart).rejects.toThrow("취소");
    await client.stop();
    const secondStart = client.start();
    await vi.advanceTimersByTimeAsync(10);
    await cancelled;
    await secondStart;

    expect(client.getStatus()).toBe("connected");
    expect(statuses).toEqual(["idle", "connecting", "idle", "connecting", "connected"]);
  });
});
