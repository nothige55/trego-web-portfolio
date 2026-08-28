import { describe, expect, it, vi } from "vitest";

import { createAiPlannerApiClient } from "@/features/ai-planner/api/ai-planner-api-client";

function createNdjsonResponse(lines: readonly unknown[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(`${JSON.stringify(lines[0])}\n${JSON.stringify(lines[1])}`),
        );
        controller.enqueue(encoder.encode(`\n${JSON.stringify(lines[2])}\n`));
        controller.close();
      },
    }),
    { status: 200 },
  );
}

describe("createAiPlannerApiClient", () => {
  it("forwards the authenticated conversation context and parses chunked NDJSON", async () => {
    const events = [
      { type: "text-delta", text: "일정을 확인했습니다." },
      {
        type: "proposal",
        proposal: {
          assumptions: [],
          operations: [
            {
              type: "update-activity-time",
              pathId: "activity-1",
              startTime: "14:00",
              endTime: "15:30",
              reason: "오후 요청 반영",
            },
          ],
          summary: "오후로 시간을 조정합니다.",
          warnings: [],
        },
      },
      { type: "finish" },
    ] as const;
    const fetchImplementation = vi.fn<typeof fetch>();
    fetchImplementation.mockResolvedValue(createNdjsonResponse(events));
    const client = createAiPlannerApiClient({
      accessToken: "access-token",
      fetchImplementation,
      projectId: "project-1",
    });
    const receivedEvents = [];

    for await (const event of client.stream(
      {
        contextItems: [{ kind: "activity", name: "아사쿠사", pathId: "activity-1" }],
        messages: [{ role: "user", content: "오후로 늦춰줘" }],
      },
      { signal: new AbortController().signal },
    )) {
      receivedEvents.push(event);
    }

    expect(receivedEvents).toEqual(events);
    expect(fetchImplementation).toHaveBeenCalledWith(
      "/ai/v1/planner/chat",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer access-token" }),
      }),
    );
    const request = fetchImplementation.mock.calls[0]?.[1];
    expect(JSON.parse(String(request?.body))).toEqual({
      projectId: "project-1",
      messages: [{ role: "user", content: "오후로 늦춰줘" }],
      contextItems: [{ kind: "activity", name: "아사쿠사", pathId: "activity-1" }],
      selectedPathIds: ["activity-1"],
    });
  });

  it("surfaces a rejected proposal instead of failing the stream", async () => {
    const events = [
      { type: "text-delta", text: "확인했습니다." },
      { type: "proposal-rejected", reason: "현재 문맥에 없는 Activity가 포함되었습니다." },
      { type: "finish" },
    ] as const;
    const client = createAiPlannerApiClient({
      accessToken: "access-token",
      fetchImplementation: vi.fn<typeof fetch>().mockResolvedValue(createNdjsonResponse(events)),
      projectId: "project-1",
    });
    const receivedEvents = [];

    for await (const event of client.stream(
      { contextItems: [], messages: [{ role: "user", content: "옮겨줘" }] },
      { signal: new AbortController().signal },
    )) {
      receivedEvents.push(event);
    }

    expect(receivedEvents).toEqual(events);
  });

  it("reports a failed API response before reading the stream", async () => {
    const client = createAiPlannerApiClient({
      accessToken: "access-token",
      fetchImplementation: vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status: 503 })),
      projectId: "project-1",
    });

    await expect(
      (async () => {
        for await (const event of client.stream(
          { contextItems: [], messages: [{ role: "user", content: "도와줘" }] },
          { signal: new AbortController().signal },
        )) {
          void event;
        }
      })(),
    ).rejects.toThrow("AI 플래너 요청에 실패했습니다. (503)");
  });
});
