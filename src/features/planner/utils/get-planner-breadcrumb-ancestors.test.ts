import { describe, expect, it } from "vitest";

import { demoPlannerProject } from "@/features/planner/data/demo-planner";
import { buildPlannerTree } from "@/features/planner/utils/build-planner-tree";
import { getPlannerBreadcrumbAncestors } from "@/features/planner/utils/get-planner-breadcrumb-ancestors";

describe("getPlannerBreadcrumbAncestors", () => {
  const tree = buildPlannerTree(demoPlannerProject.nodes);

  it("returns the region and Day for an activity without exposing the root", () => {
    expect(
      getPlannerBreadcrumbAncestors("day-one-airport", "root", tree.entityMap).map(
        (node) => node.pathId,
      ),
    ).toEqual(["region-jeju", "day-one"]);
  });

  it("returns only the region for a Day", () => {
    expect(
      getPlannerBreadcrumbAncestors("day-one", "root", tree.entityMap).map((node) => node.pathId),
    ).toEqual(["region-jeju"]);
  });

  it("returns an empty path for a root child or missing item", () => {
    expect(getPlannerBreadcrumbAncestors("region-jeju", "root", tree.entityMap)).toEqual([]);
    expect(getPlannerBreadcrumbAncestors("missing", "root", tree.entityMap)).toEqual([]);
  });
});
