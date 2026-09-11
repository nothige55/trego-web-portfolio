// 일정 트리에서 뽑아 지도에 넘기는 표시 모델(마커, Day 경로선, focus 대상)의 타입
// build-planner-map-model이 만들고 마커·경로선·카메라 모듈이 받아 그림

import type { PlannerNodePathId } from "@/features/planner/types/planner-node";

export type PlannerMapCoordinate = readonly [longitude: number, latitude: number];

export interface PlannerMapMarker {
  readonly pathId: PlannerNodePathId;
  readonly containerPathId: PlannerNodePathId;
  readonly dayPathId: PlannerNodePathId | null;
  readonly name: string;
  readonly number: number;
  readonly color: string;
  readonly coordinate: PlannerMapCoordinate;
  readonly opacity: number;
  readonly isSelected: boolean;
  readonly isHovered: boolean;
}

export interface PlannerMapRoute {
  readonly dayPathId: PlannerNodePathId;
  readonly color: string;
  readonly coordinates: readonly PlannerMapCoordinate[];
  readonly opacity: number;
  readonly isHovered: boolean;
}

export interface PlannerMapFocus {
  readonly pathId: PlannerNodePathId;
  readonly kind: "point" | "bounds";
  readonly coordinates: readonly PlannerMapCoordinate[];
}

export interface PlannerMapModel {
  readonly markers: readonly PlannerMapMarker[];
  readonly routes: readonly PlannerMapRoute[];
  readonly focus: PlannerMapFocus | null;
}
