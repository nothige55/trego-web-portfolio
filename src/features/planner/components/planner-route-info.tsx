import { Bus, Car, Footprints } from "lucide-react";

import type { PlannerActivityNode } from "@/features/planner/types/planner-node";
import {
  calculatePlannerDistanceKm,
  formatPlannerDistance,
} from "@/features/planner/utils/calculate-planner-distance";

// 행 위에 끼어드는 고정 높이다. 드래그 미리보기가 이만큼 위에서 시작하므로 상수로 공유한다.
export const PLANNER_ROUTE_INFO_HEIGHT = 30;

// 노드 아이콘(16px)이 토글 칸(20px) 다음에 오므로 그 가운데가 세로선의 x 위치다.
const CONNECTOR_OFFSET = 28;

const pillClassName =
  "flex items-center rounded border border-[#F5F5F5] p-1 text-[10px] leading-none text-[#9D9D9D]";

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
      className="relative flex items-center"
      style={{ height: PLANNER_ROUTE_INFO_HEIGHT, paddingLeft: indentation + 44 }}
      data-testid={`planner-route-${activity.pathId}`}
    >
      {/* 앞뒤 장소의 마커를 잇는 세로선. Day 색을 그대로 이어받는다. */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0 border-l"
        style={{ left: indentation + CONNECTOR_OFFSET, borderColor: activity.color ?? undefined }}
      />
      {/* 선 위에 겹쳐 그리려고 위치를 잡는다. 음수 z-index는 카드 배경 뒤로 숨는다. */}
      <div className="relative flex w-fit items-center gap-2">
        <span className={`${pillClassName} w-10 justify-center bg-white`}>
          {formatPlannerDistance(distance)}
        </span>
        <span className={`${pillClassName} gap-1`}>
          <TravelModeIcon aria-hidden="true" className="size-2.5" />
          {travelModeLabel}
          {activity.travelTime && activity.travelTime > 0 ? ` ${activity.travelTime}분` : ""}
        </span>
        <a
          className="rounded border border-transparent p-1 text-[10px] leading-none text-[#9D9D9D] underline hover:text-foreground"
          href={directionsUrl.toString()}
          target="_blank"
          rel="noreferrer"
          aria-label={`${previousActivity.name}에서 ${activity.name}까지 길찾기`}
          onPointerDown={(event) => event.stopPropagation()}
        >
          길찾기
        </a>
      </div>
    </div>
  );
}
