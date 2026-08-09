import { describe, expect, it, vi } from "vitest";

import { ProjectMemberInviteForm } from "@/features/project-management/components/project-member-invite-form";
import type { ApiClient } from "@/lib/api-client";
import { render, screen, userEvent } from "@/testing/test-utils";

describe("ProjectMemberInviteForm", () => {
  it("adds an existing account as an editor by default", async () => {
    const user = userEvent.setup();
    const post = vi.fn().mockResolvedValue(undefined);
    render(
      <ProjectMemberInviteForm
        client={{ post } as unknown as Pick<ApiClient, "post">}
        projectId="project-id"
      />,
    );

    await user.type(screen.getByLabelText("멤버 이메일"), "two@example.com");
    await user.click(screen.getByRole("button", { name: "추가" }));

    expect(post).toHaveBeenCalledWith("/api/projects/project-id/members", {
      memberEmail: "two@example.com",
      role: "editor",
    });
    expect(await screen.findByRole("status")).toHaveTextContent("멤버를 추가했습니다");
  });
});
