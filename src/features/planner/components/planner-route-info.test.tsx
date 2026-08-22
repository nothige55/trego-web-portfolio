import { describe, expect, it } from "vitest";

import { PlannerRouteInfo } from "@/features/planner/components/planner-route-info";
import type { PlannerActivityNode } from "@/features/planner/types/planner-node";
import { render, screen } from "@/testing/test-utils";

function activity(overrides: Partial<PlannerActivityNode>): PlannerActivityNode {
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
    latitude: 33.497,
    longitude: 126.452,
    googlePlaceId: null,
    ...overrides,
  };
}

describe("PlannerRouteInfo", () => {
  it("shows calculated distance, persisted travel metadata, and a coordinate directions link", () => {
    render(
      <PlannerRouteInfo
        previousActivity={activity({
          name: "제주국제공항",
          latitude: 33.5104,
          longitude: 126.4914,
        })}
        activity={activity({ name: "이호테우해변", travelMode: "car", travelTime: 15 })}
        indentation={30}
      />,
    );

    expect(screen.getByText("3.9km")).toBeInTheDocument();
    expect(screen.getByText("자동차 15분")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "제주국제공항에서 이호테우해변까지 길찾기" }),
    ).toHaveAttribute("href", expect.stringContaining("origin=33.5104%2C126.4914"));
  });

  it("draws the connector line in the Day color at the node icon column", () => {
    const { container } = render(
      <PlannerRouteInfo
        previousActivity={activity({ latitude: 33.5104, longitude: 126.4914 })}
        activity={activity({ color: "#2196F3" })}
        indentation={30}
      />,
    );

    const connector = container.querySelector("span[aria-hidden='true']");
    expect(connector).toHaveStyle({ borderColor: "#2196F3", left: "58px" });
  });

  it("renders nothing when either place has no coordinates", () => {
    const { container } = render(
      <PlannerRouteInfo
        previousActivity={activity({ latitude: null, longitude: null })}
        activity={activity({})}
        indentation={30}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
