import { describe, expect, it } from "vitest";

import type { PlannerActivityNode } from "@/features/planner/types/planner-node";
import {
  calculatePlannerDistanceKm,
  formatPlannerDistance,
} from "@/features/planner/utils/calculate-planner-distance";

function activity(latitude: number | null, longitude: number | null): PlannerActivityNode {
  return {
    id: "activity",
    kind: "activity",
    name: "장소",
    pathId: "activity",
    parentPathId: "day",
    position: 0,
    color: null,
    activityType: "single",
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

describe("calculatePlannerDistanceKm", () => {
  it("calculates a stable straight-line distance from activity coordinates", () => {
    const distance = calculatePlannerDistanceKm(
      activity(33.5104, 126.4914),
      activity(33.497, 126.452),
    );

    expect(distance).toBeCloseTo(3.94, 1);
    expect(formatPlannerDistance(distance!)).toBe("3.9km");
  });

  it("returns null for missing coordinates and formats short distances in meters", () => {
    expect(calculatePlannerDistanceKm(activity(null, 126), activity(33, 126))).toBeNull();
    expect(formatPlannerDistance(0.42)).toBe("420m");
  });
});
