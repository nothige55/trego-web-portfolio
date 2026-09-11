// 연속한 두 Activity 사이 구간의 거리·이동 수단·길찾기 링크를 그림
// 어느 한쪽이라도 좌표가 없어 거리를 낼 수 없으면 아무것도 그리지 않음

import { Bus, Car, Footprints } from "lucide-react";

import type { PlannerActivityNode } from "@/features/planner/types/planner-node";
import {
  calculatePlannerDistanceKm,
  formatPlannerDistance,
} from "@/features/planner/utils/calculate-planner-distance";

// 두 행 사이에 끼어드는 고정 높이
// 드래그 중에는 자리를 이 높이로 붙들어 둬야 하므로 슬롯을 그리는 쪽에서도 씀
export const PLANNER_ROUTE_INFO_HEIGHT = 24;

function getTravelMode(mode: string | null) {
  if (mode === "walk" || mode === "walking") return { label: "도보", icon: Footprints };
  if (mode === "transit" || mode === "bus") return { label: "대중교통", icon: Bus };
  return { label: "자동차", icon: Car };
}

// 두 장소 사이에 끼어드는 보조 정보
// 행 자체보다 앞에 나서지 않도록 테두리 없이 작은 글씨로만 얹되,
// 읽는 것(거리, 이동 수단)과 누르는 것(길찾기)은 색과 간격으로 갈라 놓음
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

  // 배경을 깔아 둠. 드래그로 행이 옮겨 갈 때 이 띠가 다른 행 위에 비쳐 보이면 안 됨
  return (
    <div
      className="flex items-center bg-card text-[10px] leading-none"
      style={{ height: PLANNER_ROUTE_INFO_HEIGHT, paddingLeft: indentation + 44 }}
      data-testid={`planner-route-${activity.pathId}`}
    >
      <span className="flex items-center gap-1.5 text-[#9D9D9D]">
        {/* 행과 행 사이에 끼어든 줄임을 알리는 짧은 선. 아이콘 열의 세로선을 대신 */}
        <span aria-hidden="true" className="h-px w-2.5 bg-[#C4C4C4]" />
        <span className="tabular-nums">{formatPlannerDistance(distance)}</span>
        <span aria-hidden="true">·</span>
        <span className="flex items-center gap-1">
          <TravelModeIcon aria-hidden="true" className="size-2.5" />
          {travelModeLabel}
          {activity.travelTime && activity.travelTime > 0 ? ` ${activity.travelTime}분` : ""}
        </span>
      </span>
      <a
        className="ml-3 text-brand underline underline-offset-2 hover:text-brand-hover"
        href={directionsUrl.toString()}
        target="_blank"
        rel="noreferrer"
        aria-label={`${previousActivity.name}에서 ${activity.name}까지 길찾기`}
        onPointerDown={(event) => event.stopPropagation()}
      >
        길찾기
      </a>
    </div>
  );
}
