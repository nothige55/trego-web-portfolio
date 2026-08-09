import { describe, expect, it, vi } from "vitest";

import {
  getCurrentMember,
  loginWithPassword,
  registerWithPassword,
} from "@/features/auth/api/auth-api";
import type { ApiClient } from "@/lib/api-client";

describe("auth API", () => {
  it("logs in with the DB password endpoint and returns the access token", async () => {
    const post = vi.fn().mockResolvedValue({ accessToken: "token" });

    await expect(
      loginWithPassword({ email: "one@example.com", password: "password" }, {
        post,
      } as unknown as Pick<ApiClient, "post">),
    ).resolves.toBe("token");
    expect(post).toHaveBeenCalledWith("/api/auth/login", {
      email: "one@example.com",
      password: "password",
    });
  });

  it("registers without Google or a profile upload", async () => {
    const post = vi.fn().mockResolvedValue(undefined);
    await registerWithPassword({ name: "One", email: "one@example.com", password: "password" }, {
      post,
    } as unknown as Pick<ApiClient, "post">);

    const [, body] = post.mock.calls[0] as [string, FormData];
    expect(post.mock.calls[0]?.[0]).toBe("/api/auth/register");
    expect(body.get("name")).toBe("One");
    expect(body.get("email")).toBe("one@example.com");
    expect(body.get("password")).toBe("password");
  });

  it("loads the current member from the authenticated DB endpoint", async () => {
    const get = vi.fn().mockResolvedValue({
      publicId: "member-id",
      name: "One",
      email: "one@example.com",
      profileUrl: null,
    });

    await expect(getCurrentMember({ get } as unknown as Pick<ApiClient, "get">)).resolves.toEqual({
      id: "member-id",
      name: "One",
      email: "one@example.com",
      profileUrl: null,
    });
    expect(get).toHaveBeenCalledWith("/api/me/info");
  });
});
