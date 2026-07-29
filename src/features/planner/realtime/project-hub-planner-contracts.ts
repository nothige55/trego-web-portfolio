import type { PlannerActivityNode } from "@/features/planner/types/planner-node";

export const EMPTY_GUID = "00000000-0000-0000-0000-000000000000";

interface CreateNodeRequestBase {
  readonly id: string;
  readonly name: string;
  readonly pathId: string;
  readonly parentPathId: string;
  readonly position: number;
}

export interface CreateFolderRequest extends CreateNodeRequestBase {
  readonly type: string;
}

export interface CreateDayRequest extends CreateNodeRequestBase {
  readonly color: string;
}

export interface CreateActivityRequest extends CreateNodeRequestBase {
  readonly type: string;
  readonly marker: string | null;
  readonly travelMode: string | null;
  readonly travelTimeMinutes: number;
  readonly travelDistanceMeters: number;
  readonly travelCost: string;
  readonly lat: number;
  readonly lng: number;
  readonly rating: number;
  readonly ratingCount: number;
  readonly googleId: string;
}

export interface UpdatePathRequest {
  readonly pathId: string;
  readonly parentPathId: string;
  readonly position: number;
}

export interface UpdateProjectRequest {
  readonly publicId: string;
  readonly title: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly isPublic: boolean;
}

export interface UpdateFolderRequest {
  readonly id: string;
  readonly name: string;
  readonly type: string;
}

export interface UpdateDayRequest {
  readonly id: string;
  readonly name: string;
  readonly color: string;
}

export interface UpdateActivityRequest {
  readonly id: string;
  readonly name?: string | null;
  readonly memo?: string | null;
  readonly startTime?: string | null;
  readonly endTime?: string | null;
  readonly marker?: string | null;
  readonly travelMode?: string | null;
  readonly travelTimeMinuates?: number | null;
  readonly travelDistanceMeters?: number | null;
  readonly travelCost?: string | null;
}

export interface DeleteNodeRequest {
  readonly pathId: string;
}

export interface PlannerHubCommandMap {
  readonly CreateFolder: CreateFolderRequest;
  readonly CreateDay: CreateDayRequest;
  readonly CreateActivity: CreateActivityRequest;
  readonly UpdatePath: UpdatePathRequest;
  readonly UpdateProject: UpdateProjectRequest;
  readonly UpdateFolder: UpdateFolderRequest;
  readonly UpdateDay: UpdateDayRequest;
  readonly UpdateActivity: UpdateActivityRequest;
  readonly DeleteNode: DeleteNodeRequest;
}

export interface PlannerHubEventMap {
  readonly OnFolderCreated: CreateFolderRequest;
  readonly OnDayCreated: CreateDayRequest;
  readonly OnActivityCreated: CreateActivityRequest;
  readonly OnPathUpdated: UpdatePathRequest;
  readonly OnProjectDateUpdated: UpdateProjectRequest;
  readonly OnFolderUpdated: UpdateFolderRequest;
  readonly OnDayUpdated: UpdateDayRequest;
  readonly OnActivityUpdated: UpdateActivityRequest;
  readonly OnNodeDeleted: DeleteNodeRequest;
}

export type PlannerHubCommandName = keyof PlannerHubCommandMap;
export type PlannerHubEventName = keyof PlannerHubEventMap;

export type PlannerHubEvent = {
  [TName in PlannerHubEventName]: {
    readonly name: TName;
    readonly payload: PlannerHubEventMap[TName];
  };
}[PlannerHubEventName];

interface CreateNodeInputBase {
  readonly id: string;
  readonly name: string;
  readonly pathId: string;
  readonly parentPathId: string | null;
  readonly position: number;
}

export interface CreateFolderInput extends CreateNodeInputBase {
  readonly folderType: string;
}

export interface CreateDayInput extends CreateNodeInputBase {
  readonly color: string;
}

export interface CreateActivityInput extends CreateNodeInputBase {
  readonly activityType: string;
  readonly markerType: string | null;
  readonly travelMode: string | null;
  readonly travelTime: number;
  readonly travelDistance: number;
  readonly travelCost: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly rating: number;
  readonly ratingCount: number;
  readonly googlePlaceId: string;
}

export interface UpdatePathInput {
  readonly pathId: string;
  readonly parentPathId: string | null;
  readonly position: number;
}

export type UpdateProjectInput = UpdateProjectRequest;

export interface UpdateFolderInput {
  readonly id: string;
  readonly name: string;
  readonly folderType: string;
}

export type UpdateDayInput = UpdateDayRequest;

export interface UpdateActivityInput {
  readonly id: string;
  readonly name?: string | null;
  readonly memo?: string | null;
  readonly startTime?: string | null;
  readonly endTime?: string | null;
  readonly markerType?: string | null;
  readonly travelMode?: string | null;
  readonly travelTime?: number | null;
  readonly travelDistance?: number | null;
  readonly travelCost?: string | null;
}

export type DeleteNodeInput = DeleteNodeRequest;

export interface PlannerProjectUpdate {
  readonly publicId: string;
  readonly title: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly isPublic: boolean;
}

export type PlannerActivityUpdate = Partial<
  Pick<
    PlannerActivityNode,
    | "name"
    | "memo"
    | "startTime"
    | "endTime"
    | "markerType"
    | "travelMode"
    | "travelTime"
    | "travelDistance"
    | "travelCost"
  >
> & { readonly id: string };
