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
          id: "proposal-1",
          operations: [
            {
              after: "14:00",
              before: "10:00",
              id: "operation-1",
              label: "아사쿠사 시간 조정",
              pathId: "activity-1",
              reason: "오후 요청 반영",
              type: "update-activity-time",
            },
          ],
          status: "draft",
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
      apiBaseUrl: "https://api.example.com/",
      fetchImplementation,
      projectId: "project/1",
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
      "https://api.example.com/api/v2/projects/project%2F1/ai/chat",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer access-token" }),
      }),
    );
    const request = fetchImplementation.mock.calls[0]?.[1];
    expect(JSON.parse(String(request?.body))).toEqual({
      messages: [{ role: "user", content: "오후로 늦춰줘" }],
      selectedPathIds: ["activity-1"],
    });
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
