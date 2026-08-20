import { Bus, Car, ExternalLink, Footprints, Route } from "lucide-react";

import type { PlannerActivityNode } from "@/features/planner/types/planner-node";
import {
  calculatePlannerDistanceKm,
  formatPlannerDistance,
} from "@/features/planner/utils/calculate-planner-distance";

function getTravelMode(mode: string | null) {
  if (mode === "walk" || mode === "walking") return { label: "도보", icon: Footprints };
  if (mode === "transit" || mode === "bus") return { label: "대중교통", icon: Bus };
  return { label: "자동차", icon: Car };
}

export function PlannerRouteInfo({
  activity,
  previousActivity,
  indentation,
}: {
  readonly activity: PlannerActivityNode;
  readonly previousActivity: PlannerActivityNode;
  readonly indentation: number;
}) {
  const distance = calculatePlannerDistanceKm(previousActivity, activity);
  if (distance === null) return null;

  const { label: travelModeLabel, icon: TravelModeIcon } = getTravelMode(activity.travelMode);
  const directionsUrl = new URL("https://www.google.com/maps/dir/");
  directionsUrl.searchParams.set("api", "1");
  directionsUrl.searchParams.set(
    "origin",
    `${previousActivity.latitude},${previousActivity.longitude}`,
  );
  directionsUrl.searchParams.set("destination", `${activity.latitude},${activity.longitude}`);

  return (
    <div
      className="flex min-h-7 items-center gap-1.5 border-l-2 border-transparent py-1 text-[10px] text-muted-foreground"
      style={{ paddingLeft: indentation + 44 }}
      data-testid={`planner-route-${activity.pathId}`}
    >
      <span className="inline-flex items-center gap-1 rounded border bg-background px-1.5 py-1">
        <Route aria-hidden="true" className="size-3" />
        직선 {formatPlannerDistance(distance)}
      </span>
      <span className="inline-flex items-center gap-1 rounded border bg-background px-1.5 py-1">
        <TravelModeIcon aria-hidden="true" className="size-3" />
        {travelModeLabel}
        {activity.travelTime && activity.travelTime > 0 ? ` ${activity.travelTime}분` : ""}
      </span>
      <a
        className="inline-flex items-center gap-0.5 rounded px-1 py-1 underline-offset-2 hover:text-foreground hover:underline"
        href={directionsUrl.toString()}
        target="_blank"
        rel="noreferrer"
        aria-label={`${previousActivity.name}에서 ${activity.name}까지 길찾기`}
        onPointerDown={(event) => event.stopPropagation()}
      >
        길찾기
        <ExternalLink aria-hidden="true" className="size-2.5" />
      </a>
    </div>
  );
}
