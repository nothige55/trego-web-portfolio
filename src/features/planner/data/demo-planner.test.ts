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
});
