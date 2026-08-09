import { describe, expect, it, vi } from "vitest";

import {
  addProjectMember,
  createProject,
  getMyProjects,
} from "@/features/project-management/api/project-management-api";
import type { ApiClient } from "@/lib/api-client";

describe("project management API", () => {
  it("loads the authenticated member projects", async () => {
    const get = vi.fn().mockResolvedValue([]);
    await expect(getMyProjects({ get } as unknown as Pick<ApiClient, "get">)).resolves.toEqual([]);
    expect(get).toHaveBeenCalledWith("/api/me/projects");
  });

  it("creates a project with its client-generated root path", async () => {
    const post = vi.fn().mockResolvedValue(undefined);
    const input = {
      title: "제주 여행",
      startDate: "2026-09-01",
      endDate: "2026-09-03",
      rootPathId: "root-path-id",
    };
    await createProject(input, { post } as unknown as Pick<ApiClient, "post">);
    expect(post).toHaveBeenCalledWith("/api/projects", input);
  });

  it("adds an existing DB member to the same project", async () => {
    const post = vi.fn().mockResolvedValue(undefined);
    await addProjectMember("project-id", "two@example.com", "editor", { post } as unknown as Pick<
      ApiClient,
      "post"
    >);
    expect(post).toHaveBeenCalledWith("/api/projects/project-id/members", {
      memberEmail: "two@example.com",
      role: "editor",
    });
  });
});
