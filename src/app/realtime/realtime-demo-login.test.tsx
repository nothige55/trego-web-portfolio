import { describe, expect, it, vi } from "vitest";

import { RealtimeDemoLogin } from "@/app/realtime/realtime-demo-login";
import type { ApiClient } from "@/lib/api-client";
import { render, screen, userEvent } from "@/testing/test-utils";

describe("RealtimeDemoLogin", () => {
  it("uses the existing login endpoint and returns the realtime identity", async () => {
    const user = userEvent.setup();
    const post = vi.fn().mockResolvedValue({
      accessToken: "token",
      email: "one@example.com",
      id: "11111111-1111-1111-1111-111111111111",
      name: "One",
    });
    const onAuthenticated = vi.fn();
    render(
      <RealtimeDemoLogin
        client={{ post } as unknown as Pick<ApiClient, "post">}
        projectId="project-id"
        onAuthenticated={onAuthenticated}
      />,
    );

    await user.type(screen.getByLabelText("이메일"), "one@example.com");
    await user.type(screen.getByLabelText("비밀번호"), "password");
    await user.click(screen.getByRole("button", { name: "로그인하고 연결" }));

    expect(post).toHaveBeenCalledWith("/api/auth/login", {
      email: "one@example.com",
      password: "password",
    });
    expect(onAuthenticated).toHaveBeenCalledWith({
      accessToken: "token",
      email: "one@example.com",
      id: "11111111-1111-1111-1111-111111111111",
      name: "One",
    });
  });
});
