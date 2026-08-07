import { describe, expect, it } from "vitest";

import { demoPlannerProject } from "@/features/planner/data/demo-planner";
import { buildPlannerTree } from "@/features/planner/utils/build-planner-tree";

describe("demoPlannerProject", () => {
  it("provides three Jeju days and four Seogwipo days with four places each", () => {
    const tree = buildPlannerTree(demoPlannerProject.nodes);
    const jejuDays = tree.childrenMap.get("region-jeju") ?? [];
    const seogwipoDays = tree.childrenMap.get("region-seogwipo") ?? [];

    expect(jejuDays.map((day) => day.pathId)).toEqual(["day-one", "day-two", "day-three"]);
    expect(seogwipoDays.map((day) => day.pathId)).toEqual([
      "day-four",
      "day-five",
      "day-six",
      "day-seven",
    ]);

    [...jejuDays, ...seogwipoDays].forEach((day) => {
      expect(tree.childrenMap.get(day.pathId)).toHaveLength(4);
    });
  });

  it("uses the legacy default folder contract for region containers", () => {
    const tree = buildPlannerTree(demoPlannerProject.nodes);

    expect(tree.entityMap.get("region-jeju")).toMatchObject({
      kind: "folder",
      folderType: "default",
    });
    expect(tree.entityMap.get("region-seogwipo")).toMatchObject({
      kind: "folder",
      folderType: "default",
    });
  });

  it("keeps the empty wish and provides group drop fixtures under a root day", () => {
    const tree = buildPlannerTree(demoPlannerProject.nodes);

    expect(tree.entityMap.get("empty-wish")).toMatchObject({
      kind: "folder",
      folderType: "wish",
      parentPathId: "root",
    });
    expect(tree.childrenMap.get("empty-wish") ?? []).toHaveLength(0);
    expect(tree.entityMap.get("dnd-test-day")).toMatchObject({
      kind: "day",
      parentPathId: "root",
    });
    expect(tree.childrenMap.get("dnd-test-day")?.map((node) => node.pathId)).toEqual([
      "dnd-empty-group",
      "dnd-single-activity",
    ]);
    expect(tree.entityMap.get("dnd-empty-group")).toMatchObject({
      activityType: "group",
    });
    expect(tree.childrenMap.get("dnd-empty-group") ?? []).toHaveLength(0);
    expect(tree.entityMap.get("dnd-single-activity")).toMatchObject({
      activityType: "single",
    });
  });

  it("uses the legacy single or group contract for demo activities", () => {
    const activityTypes = demoPlannerProject.nodes
      .filter((node) => node.kind === "activity")
      .map((node) => node.activityType);

    expect(activityTypes).toContain("single");
    expect(activityTypes).toContain("group");
    expect(activityTypes).not.toContain("place");
  });
});
