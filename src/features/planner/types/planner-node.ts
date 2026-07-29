interface PlannerNodeBase {
  readonly id: string;
  readonly name: string;
  readonly pathId: string;
  readonly parentPathId: string | null;
  readonly position: number;
  readonly color?: string | null;
}

export interface PlannerFolderNode extends PlannerNodeBase {
  readonly kind: "folder";
  readonly folderType: string | null;
}

export interface PlannerDayNode extends PlannerNodeBase {
  readonly kind: "day";
  readonly color: string | null;
}

export interface PlannerActivityNode extends PlannerNodeBase {
  readonly kind: "activity";
  readonly activityType: string | null;
  readonly memo: string | null;
  readonly markerType: string | null;
  readonly travelMode: string | null;
  readonly travelTime: number | null;
  readonly travelDistance: number | null;
  readonly travelCost: string | null;
  readonly startTime: string | null;
  readonly endTime: string | null;
  readonly placeId: number | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly googlePlaceId: string | null;
}

export type PlannerNode = PlannerFolderNode | PlannerDayNode | PlannerActivityNode;

export type PlannerNodeKind = PlannerNode["kind"];
export type PlannerNodePathId = PlannerNode["pathId"];
export type PlannerParentPathId = PlannerNode["parentPathId"];

export type FlattenedPlannerNode = PlannerNode & {
  readonly depth: number;
  readonly siblingIndex: number;
  readonly color: string | null;
};

export interface PlannerTree {
  readonly entityMap: ReadonlyMap<PlannerNodePathId, FlattenedPlannerNode>;
  readonly childrenMap: ReadonlyMap<PlannerParentPathId, readonly FlattenedPlannerNode[]>;
  readonly flattenedItems: readonly FlattenedPlannerNode[];
}
