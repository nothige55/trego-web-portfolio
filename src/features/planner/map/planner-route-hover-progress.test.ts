import { describe, expect, it } from "vitest";

import type { PlannerMapRoute } from "@/features/planner/map/planner-map-model";
import {
  ROUTE_HOVER_TRANSITION_MS,
  stepPlannerRouteHoverProgress,
} from "@/features/planner/map/planner-route-hover-progress";

function createRoute(dayPathId: string, isHovered: boolean): PlannerMapRoute {
  return {
    dayPathId,
    color: "#000000",
    coordinates: [
      [0, 0],
      [1, 1],
    ],
    opacity: 1,
    isHovered,
  };
}

describe("stepPlannerRouteHoverProgress", () => {
  it("starts a newly rendered route at its target without animating", () => {
    const { progress, isSettled } = stepPlannerRouteHoverProgress(
      new Map(),
      [createRoute("day-one", true), createRoute("day-two", false)],
      0,
    );

    expect(progress.get("day-one")).toBe(1);
    expect(progress.get("day-two")).toBe(0);
    expect(isSettled).toBe(true);
  });

  it("eases toward the hovered target over the transition duration", () => {
    const routes = [createRoute("day-one", true)];
    const half = stepPlannerRouteHoverProgress(
      new Map([["day-one", 0]]),
      routes,
      ROUTE_HOVER_TRANSITION_MS / 2,
    );

    expect(half.progress.get("day-one")).toBeCloseTo(0.5);
    expect(half.isSettled).toBe(false);

    const settled = stepPlannerRouteHoverProgress(
      half.progress,
      routes,
      ROUTE_HOVER_TRANSITION_MS / 2,
    );

    expect(settled.progress.get("day-one")).toBe(1);
    expect(settled.isSettled).toBe(true);
  });

  it("eases back down when the hover moves away and never overshoots", () => {
    const { progress, isSettled } = stepPlannerRouteHoverProgress(
      new Map([["day-one", 0.4]]),
      [createRoute("day-one", false)],
      ROUTE_HOVER_TRANSITION_MS * 10,
    );

    expect(progress.get("day-one")).toBe(0);
    expect(isSettled).toBe(true);
  });

  it("drops progress for routes that are no longer rendered", () => {
    const { progress } = stepPlannerRouteHoverProgress(
      new Map([
        ["day-one", 1],
        ["day-gone", 1],
      ]),
      [createRoute("day-one", true)],
      0,
    );

    expect(progress.has("day-gone")).toBe(false);
    expect([...progress.keys()]).toEqual(["day-one"]);
  });
});
