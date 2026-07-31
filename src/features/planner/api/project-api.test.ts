import { describe, expect, it, vi } from "vitest";

import {
  getProjectDetails,
  getProjectNodes,
  normalizeProjectNode,
} from "@/features/planner/api/project-api";
import { EMPTY_GUID } from "@/features/planner/realtime/project-hub-planner-contracts";
import type { ApiClient } from "@/lib/api-client";

describe("planner project API", () => {
  it("normalizes the legacy REST node shape into the planner domain", () => {
    expect(
      normalizeProjectNode({
        folderId: "folder-id",
        folderName: "Root",
        folderType: "root",
        pathId: "path-id",
        parentPathId: EMPTY_GUID,
        position: 0,
      }),
    ).toEqual({
      kind: "folder",
      id: "folder-id",
      name: "Root",
      folderType: "root",
      color: null,
      pathId: "path-id",
      parentPathId: null,
      position: 0,
    });
  });

  it("loads project details and nodes through the injected REST client", async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce({
        publicId: "project-id",
        title: "Live project",
        startDate: "2026-08-01T00:00:00Z",
        endDate: "2026-08-03T00:00:00Z",
        isPublic: false,
      })
      .mockResolvedValueOnce([
        {
          dayId: "day-id",
          dayName: "첫날",
          color: "#fff",
          pathId: "day-path",
          parentPathId: EMPTY_GUID,
          position: 0,
        },
      ]);
    const client = { get } as unknown as Pick<ApiClient, "get">;

    await expect(getProjectDetails("project-id", client)).resolves.toMatchObject({
      publicId: "project-id",
      title: "Live project",
    });
    await expect(getProjectNodes("project-id", client)).resolves.toMatchObject([
      { kind: "day", id: "day-id", parentPathId: null },
    ]);
    expect(get).toHaveBeenNthCalledWith(1, "/api/projects/project-id");
    expect(get).toHaveBeenNthCalledWith(2, "/api/projects/project-id/nodes");
  });
});
