import { describe, expect, it, vi } from "vitest";

import { verifyMember } from "./verify-member.js";

describe("verifyMember", () => {
  it("asks the ASP.NET API who the caller is and forwards the original token", async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ publicId: "member-1", name: "지나" }));

    const result = await verifyMember({
      apiBaseUrl: "http://localhost:3000/",
      authorization: "Bearer access-token",
      fetchImplementation,
    });

    expect(result).toEqual({ status: "authenticated", memberId: "member-1" });
    expect(fetchImplementation).toHaveBeenCalledWith(
      "http://localhost:3000/api/me/info",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer access-token" }),
      }),
    );
  });

  it("reports an unauthorized session without throwing", async () => {
    const result = await verifyMember({
      apiBaseUrl: "http://localhost:3000",
      authorization: "Bearer expired",
      fetchImplementation: vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status: 401 })),
    });

    expect(result).toEqual({ status: "unauthorized" });
  });

  it("throws when the API is reachable but does not identify the member", async () => {
    await expect(
      verifyMember({
        apiBaseUrl: "http://localhost:3000",
        authorization: "Bearer access-token",
        fetchImplementation: vi.fn<typeof fetch>().mockResolvedValue(Response.json({})),
      }),
    ).rejects.toThrow("did not include a public ID");
  });

  it("throws on an upstream failure so the gateway can answer 502", async () => {
    await expect(
      verifyMember({
        apiBaseUrl: "http://localhost:3000",
        authorization: "Bearer access-token",
        fetchImplementation: vi
          .fn<typeof fetch>()
          .mockResolvedValue(new Response(null, { status: 500 })),
      }),
    ).rejects.toThrow("status 500");
  });
});
