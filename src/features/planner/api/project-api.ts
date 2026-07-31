import { normalizeParentPathId } from "@/features/planner/realtime/planner-realtime-reducer";
import type { PlannerNode } from "@/features/planner/types/planner-node";
import type { PlannerProjectDetails } from "@/features/planner/types/planner-project";
import type { ApiClient } from "@/lib/api-client";
import { apiClient } from "@/lib/api-client";

export interface ProjectNodeResponse {
  readonly folderId?: string | null;
  readonly folderName?: string | null;
  readonly folderType?: string | null;
  readonly dayId?: string | null;
  readonly dayName?: string | null;
  readonly color?: string | null;
  readonly activityId?: string | null;
  readonly activityName?: string | null;
  readonly memo?: string | null;
  readonly activityType?: string | null;
  readonly markerType?: string | null;
  readonly travelMode?: string | null;
  readonly travelTime?: number | null;
  readonly travelDistance?: number | null;
  readonly travelCost?: string | null;
  readonly startTime?: string | null;
  readonly endTime?: string | null;
  readonly placeId?: number | null;
  readonly lat?: number | null;
  readonly lng?: number | null;
  readonly googleId?: string | null;
  readonly pathId: string;
  readonly position: number;
  readonly parentPathId: string;
}

interface ProjectDetailsResponse extends PlannerProjectDetails {
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly likeCount: number;
  readonly viewCount: number;
  readonly thumbnailUrl: string;
}

export function normalizeProjectNode(node: ProjectNodeResponse): PlannerNode {
  const base = {
    pathId: node.pathId,
    parentPathId: normalizeParentPathId(node.parentPathId),
    position: node.position,
  };

  if (node.folderId) {
    return {
      ...base,
      kind: "folder",
      id: node.folderId,
      name: node.folderName ?? "이름 없는 폴더",
      folderType: node.folderType ?? null,
      color: node.color ?? null,
    };
  }

  if (node.dayId) {
    return {
      ...base,
      kind: "day",
      id: node.dayId,
      name: node.dayName ?? "이름 없는 날짜",
      color: node.color ?? null,
    };
  }

  if (node.activityId) {
    return {
      ...base,
      kind: "activity",
      id: node.activityId,
      name: node.activityName ?? "이름 없는 장소",
      activityType: node.activityType ?? null,
      memo: node.memo ?? null,
      markerType: node.markerType ?? null,
      travelMode: node.travelMode ?? null,
      travelTime: node.travelTime ?? null,
      travelDistance: node.travelDistance ?? null,
      travelCost: node.travelCost ?? null,
      startTime: node.startTime ?? null,
      endTime: node.endTime ?? null,
      placeId: node.placeId ?? null,
      latitude: node.lat ?? null,
      longitude: node.lng ?? null,
      googlePlaceId: node.googleId ?? null,
    };
  }

  throw new TypeError(`Project node ${node.pathId} has no supported entity id.`);
}

export async function getProjectDetails(
  projectId: string,
  client: Pick<ApiClient, "get"> = apiClient,
): Promise<PlannerProjectDetails> {
  const response = await client.get<ProjectDetailsResponse>(`/api/projects/${projectId}`);

  return {
    publicId: response.publicId,
    title: response.title,
    startDate: response.startDate.slice(0, 10),
    endDate: response.endDate.slice(0, 10),
    isPublic: response.isPublic,
  };
}

export async function getProjectNodes(
  projectId: string,
  client: Pick<ApiClient, "get"> = apiClient,
): Promise<readonly PlannerNode[]> {
  const response = await client.get<readonly ProjectNodeResponse[]>(
    `/api/projects/${projectId}/nodes`,
  );

  return response.map(normalizeProjectNode);
}
