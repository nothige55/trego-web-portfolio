import { afterEach, describe, expect, it, vi } from "vitest";

import { useProjectDataLoader } from "@/app/realtime/use-project-data-loader";
import { usePlannerViewStore } from "@/features/planner/stores/planner-view-store";
import type { ApiClient } from "@/lib/api-client";
import { act, renderHook, waitFor } from "@/testing/test-utils";

const PROJECT_ID = "33333333-3333-3333-3333-333333333333";

function rootFolder(name: string) {
  return [
    {
      kind: "folder",
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      name,
      folderType: "root",
      pathId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      parentPathId: null,
      position: 0,
    },
  ];
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

// 노드 응답만 테스트마다 바꿔 끼울 수 있는 REST client
function createRestClient() {
  let getNodes: () => Promise<unknown> = async () => rootFolder("Initial");
  const get = vi.fn(async (url: string): Promise<unknown> => {
    if (url.endsWith("/nodes")) {
      return getNodes();
    }

    if (url.endsWith("/messages")) {
      return [];
    }

    return {
      publicId: PROJECT_ID,
      title: "Live project",
      startDate: "2026-08-01T00:00:00Z",
      endDate: "2026-08-03T00:00:00Z",
      isPublic: false,
    };
  });

  return {
    client: { get } as unknown as ApiClient,
    respondNodesWith(nextGetNodes: () => Promise<unknown>) {
      getNodes = nextGetNodes;
    },
  };
}

function rootFolderName(): string | undefined {
  return usePlannerViewStore.getState().nodes[0]?.name;
}

async function renderLoadedHook(rest: ReturnType<typeof createRestClient>) {
  const hook = renderHook(() =>
    useProjectDataLoader({ projectId: PROJECT_ID, restClient: rest.client }),
  );
  await waitFor(() => expect(hook.result.current.projectDataState.status).toBe("ready"));
  return hook;
}

describe("useProjectDataLoader", () => {
  afterEach(() => {
    usePlannerViewStore.getState().reset();
  });

  it("keeps the ready state during a refetch and swaps in the new nodes when they arrive", async () => {
    const rest = createRestClient();
    const { result } = await renderLoadedHook(rest);
    const readyState = result.current.projectDataState;
    expect(rootFolderName()).toBe("Initial");

    const nodesRequest = deferred<unknown>();
    rest.respondNodesWith(() => nodesRequest.promise);
    let reloadPromise!: Promise<void>;
    act(() => {
      reloadPromise = result.current.reload();
    });

    expect(result.current.projectDataState).toBe(readyState);
    expect(rootFolderName()).toBe("Initial");

    await act(async () => {
      nodesRequest.resolve(rootFolder("Refreshed"));
      await reloadPromise;
    });

    expect(result.current.projectDataState).toEqual({
      error: null,
      projectId: PROJECT_ID,
      status: "ready",
    });
    expect(rootFolderName()).toBe("Refreshed");
  });

  it("keeps stale data and records the error when a refetch fails", async () => {
    const rest = createRestClient();
    const { result } = await renderLoadedHook(rest);

    rest.respondNodesWith(() => Promise.reject(new Error("refetch failed")));
    await act(async () => {
      await expect(result.current.reload()).rejects.toThrow("refetch failed");
    });

    expect(result.current.projectDataState.status).toBe("ready");
    expect(result.current.projectDataState.error?.message).toBe("refetch failed");
    expect(rootFolderName()).toBe("Initial");

    rest.respondNodesWith(async () => rootFolder("Recovered"));
    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.projectDataState).toEqual({
      error: null,
      projectId: PROJECT_ID,
      status: "ready",
    });
    expect(rootFolderName()).toBe("Recovered");
  });

  it("shows loading again when retrying after the initial load failed", async () => {
    const rest = createRestClient();
    rest.respondNodesWith(() => Promise.reject(new Error("initial failed")));
    const { result } = renderHook(() =>
      useProjectDataLoader({ projectId: PROJECT_ID, restClient: rest.client }),
    );
    await waitFor(() => expect(result.current.projectDataState.status).toBe("error"));

    const nodesRequest = deferred<unknown>();
    rest.respondNodesWith(() => nodesRequest.promise);
    let reloadPromise!: Promise<void>;
    act(() => {
      reloadPromise = result.current.reload();
    });

    expect(result.current.projectDataState).toEqual({
      error: null,
      projectId: PROJECT_ID,
      status: "loading",
    });

    await act(async () => {
      nodesRequest.resolve(rootFolder("Retried"));
      await reloadPromise;
    });

    expect(result.current.projectDataState.status).toBe("ready");
    expect(rootFolderName()).toBe("Retried");
  });

  it("starts from loading again when the project changes", async () => {
    const rest = createRestClient();
    const { rerender, result } = renderHook(
      ({ projectId }) => useProjectDataLoader({ projectId, restClient: rest.client }),
      { initialProps: { projectId: PROJECT_ID } },
    );
    await waitFor(() => expect(result.current.projectDataState.status).toBe("ready"));

    const nodesRequest = deferred<unknown>();
    rest.respondNodesWith(() => nodesRequest.promise);
    const nextProjectId = "44444444-4444-4444-4444-444444444444";
    rerender({ projectId: nextProjectId });

    expect(result.current.projectDataState).toEqual({
      error: null,
      projectId: nextProjectId,
      status: "loading",
    });

    await act(async () => {
      nodesRequest.resolve(rootFolder("Next project"));
    });
    await waitFor(() => expect(result.current.projectDataState.status).toBe("ready"));
    expect(rootFolderName()).toBe("Next project");
  });
});
