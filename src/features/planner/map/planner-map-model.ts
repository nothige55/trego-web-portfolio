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
}

export interface PlannerMapRoute {
  readonly dayPathId: PlannerNodePathId;
  readonly color: string;
  readonly coordinates: readonly PlannerMapCoordinate[];
  readonly opacity: number;
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
