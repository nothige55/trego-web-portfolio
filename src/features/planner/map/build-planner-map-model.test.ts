import { describe, expect, it } from "vitest";

import { buildPlannerMapModel } from "@/features/planner/map/build-planner-map-model";
import type {
  PlannerActivityNode,
  PlannerDayNode,
  PlannerFolderNode,
  PlannerNode,
} from "@/features/planner/types/planner-node";
import { buildPlannerTree } from "@/features/planner/utils/build-planner-tree";

function folder(
  pathId: string,
  parentPathId: string | null,
  position: number,
  folderType: string | null = null,
): PlannerFolderNode {
  return { id: pathId, name: pathId, pathId, parentPathId, position, kind: "folder", folderType };
}

function day(
  pathId: string,
  parentPathId: string,
  position: number,
  color: string,
): PlannerDayNode {
  return { id: pathId, name: pathId, pathId, parentPathId, position, kind: "day", color };
}

function activity({
  pathId,
  parentPathId,
  position,
  latitude,
  longitude,
  activityType = null,
  color = null,
}: {
  readonly pathId: string;
  readonly parentPathId: string;
  readonly position: number;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly activityType?: string | null;
  readonly color?: string | null;
}): PlannerActivityNode {
  return {
    id: pathId,
    name: pathId,
    pathId,
    parentPathId,
    position,
    kind: "activity",
    color,
    activityType,
    memo: null,
    markerType: null,
    travelMode: null,
    travelTime: null,
    travelDistance: null,
    travelCost: null,
    startTime: null,
    endTime: null,
    placeId: null,
    latitude,
    longitude,
    googlePlaceId: null,
  };
}

function createNodes(): readonly PlannerNode[] {
  return [
    folder("root", null, 0),
    day("day-one", "root", 0.1, "#EF4444"),
    activity({
      pathId: "day-first",
      parentPathId: "day-one",
      position: 0.1,
      latitude: 33.1,
      longitude: 126.1,
    }),
    activity({
      pathId: "day-invalid",
      parentPathId: "day-one",
      position: 0.2,
      latitude: null,
      longitude: 126.2,
    }),
    activity({
      pathId: "day-third",
      parentPathId: "day-one",
      position: 0.3,
      latitude: 33.3,
      longitude: 126.3,
    }),
    activity({
      pathId: "group",
      parentPathId: "day-one",
      position: 0.4,
      latitude: null,
      longitude: null,
      activityType: "group",
      color: "#8B5CF6",
    }),
    activity({
      pathId: "group-place",
      parentPathId: "group",
      position: 0.1,
      latitude: 33.4,
      longitude: 126.4,
    }),
    folder("wish", "root", 0.2, "wish"),
    activity({
      pathId: "wish-place",
      parentPathId: "wish",
      position: 0.1,
      latitude: 33.5,
      longitude: 126.5,
    }),
  ];
}

describe("buildPlannerMapModel", () => {
  it("numbers valid markers by their original container order and builds direct Day routes", () => {
    const tree = buildPlannerTree(createNodes());

    const model = buildPlannerMapModel({
      tree,
      hiddenDayIds: new Set(),
      selectedItemId: null,
    });

    expect(model.markers).toEqual([
      expect.objectContaining({
        pathId: "day-first",
        number: 1,
        color: "#EF4444",
        coordinate: [126.1, 33.1],
      }),
      expect.objectContaining({
        pathId: "day-third",
        number: 3,
        color: "#EF4444",
        coordinate: [126.3, 33.3],
      }),
      expect.objectContaining({
        pathId: "group-place",
        number: 1,
        color: "#8B5CF6",
        dayPathId: "day-one",
      }),
      expect.objectContaining({
        pathId: "wish-place",
        number: 1,
        color: "#6B7280",
        dayPathId: null,
      }),
    ]);
    expect(model.routes).toEqual([
      {
        dayPathId: "day-one",
        color: "#EF4444",
        coordinates: [
          [126.1, 33.1],
          [126.3, 33.3],
        ],
        opacity: 1,
      },
    ]);
  });

  it("rejects non-finite and out-of-range coordinates", () => {
    const tree = buildPlannerTree([
      ...createNodes(),
      activity({
        pathId: "nan",
        parentPathId: "day-one",
        position: 0.5,
        latitude: Number.NaN,
        longitude: 126,
      }),
      activity({
        pathId: "bad-latitude",
        parentPathId: "day-one",
        position: 0.6,
        latitude: 91,
        longitude: 126,
      }),
      activity({
        pathId: "bad-longitude",
        parentPathId: "day-one",
        position: 0.7,
        latitude: 33,
        longitude: 181,
      }),
    ]);

    const model = buildPlannerMapModel({
      tree,
      hiddenDayIds: new Set(),
      selectedItemId: null,
    });

    expect(model.markers.map((marker) => marker.pathId)).not.toEqual(
      expect.arrayContaining(["nan", "bad-latitude", "bad-longitude"]),
    );
  });

  it("hides Day and descendant group markers while keeping wish markers visible", () => {
    const tree = buildPlannerTree(createNodes());

    const model = buildPlannerMapModel({
      tree,
      hiddenDayIds: new Set(["day-one"]),
      selectedItemId: null,
    });

    expect(model.markers).toEqual([expect.objectContaining({ pathId: "wish-place", opacity: 1 })]);
    expect(model.routes).toEqual([]);
  });

  it("shows a selected hidden Day and its descendant group markers at half opacity", () => {
    const tree = buildPlannerTree(createNodes());

    const model = buildPlannerMapModel({
      tree,
      hiddenDayIds: new Set(["day-one"]),
      selectedItemId: "day-one",
    });

    expect(
      model.markers
        .filter((marker) => marker.dayPathId === "day-one")
        .every((marker) => marker.opacity === 0.5),
    ).toBe(true);
    expect(model.routes).toEqual([expect.objectContaining({ dayPathId: "day-one", opacity: 0.5 })]);
    expect(model.focus).toEqual({
      pathId: "day-one",
      kind: "bounds",
      coordinates: [
        [126.1, 33.1],
        [126.3, 33.3],
        [126.4, 33.4],
      ],
    });
  });

  it("projects point focus for places and bounds focus for Day, group, and wish containers", () => {
    const tree = buildPlannerTree(createNodes());
    const buildWithSelection = (selectedItemId: string) =>
      buildPlannerMapModel({ tree, hiddenDayIds: new Set(), selectedItemId }).focus;

    expect(buildWithSelection("day-first")).toEqual({
      pathId: "day-first",
      kind: "point",
      coordinates: [[126.1, 33.1]],
    });
    expect(buildWithSelection("day-one")).toEqual({
      pathId: "day-one",
      kind: "bounds",
      coordinates: [
        [126.1, 33.1],
        [126.3, 33.3],
        [126.4, 33.4],
      ],
    });
    expect(buildWithSelection("group")).toEqual({
      pathId: "group",
      kind: "bounds",
      coordinates: [[126.4, 33.4]],
    });
    expect(buildWithSelection("wish")).toEqual({
      pathId: "wish",
      kind: "bounds",
      coordinates: [[126.5, 33.5]],
    });
  });

  it("does not create focus for unsupported containers or places without valid coordinates", () => {
    const tree = buildPlannerTree(createNodes());

    expect(
      buildPlannerMapModel({ tree, hiddenDayIds: new Set(), selectedItemId: "root" }).focus,
    ).toBeNull();
    expect(
      buildPlannerMapModel({
        tree,
        hiddenDayIds: new Set(),
        selectedItemId: "day-invalid",
      }).focus,
    ).toBeNull();
  });

  it("keeps the camera unchanged for Day, group, and wish containers without valid coordinates", () => {
    const tree = buildPlannerTree([
      folder("root", null, 0),
      day("empty-day", "root", 0.1, "#EF4444"),
      activity({
        pathId: "invalid-place",
        parentPathId: "empty-day",
        position: 0.1,
        latitude: null,
        longitude: 126.1,
      }),
      activity({
        pathId: "empty-group",
        parentPathId: "empty-day",
        position: 0.2,
        latitude: null,
        longitude: null,
        activityType: "group",
      }),
      folder("empty-wish", "root", 0.2, "wish"),
    ]);
    const buildWithSelection = (selectedItemId: string) =>
      buildPlannerMapModel({ tree, hiddenDayIds: new Set(), selectedItemId }).focus;

    expect(buildWithSelection("empty-day")).toBeNull();
    expect(buildWithSelection("empty-group")).toBeNull();
    expect(buildWithSelection("empty-wish")).toBeNull();
  });

  it("does not mutate the Planner tree", () => {
    const tree = buildPlannerTree(createNodes());
    const dayChildrenBefore = [...(tree.childrenMap.get("day-one") ?? [])];

    buildPlannerMapModel({
      tree,
      hiddenDayIds: new Set(),
      selectedItemId: null,
    });

    expect(tree.childrenMap.get("day-one")).toEqual(dayChildrenBefore);
    expect(tree.childrenMap.get("day-one")?.map((node) => node.position)).toEqual([
      0.1, 0.2, 0.3, 0.4,
    ]);
  });
});
