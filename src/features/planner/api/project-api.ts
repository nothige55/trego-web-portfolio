// 프로젝트 상세와 일정 노드를 REST로 조회하고 서버 응답을 PlannerNode 도메인 타입으로 정규화
// 호출은 app 레이어의 프로젝트 데이터 로더가 맡음

import { normalizeParentPathId } from "@/features/planner/realtime/planner-realtime-reducer";
import type { PlannerNode } from "@/features/planner/types/planner-node";
import type { PlannerProjectDetails } from "@/features/planner/types/planner-project";
import type { ApiClient } from "@/lib/api-client";
import { apiClient } from "@/lib/api-client";

export interface ProjectNodeResponse {
  readonly kind: "activity" | "day" | "folder";
  readonly id: string;
  readonly name: string;
  readonly folderType?: string | null;
  readonly color?: string | null;
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
  readonly latitude?: number | null;
  readonly longitude?: number | null;
  readonly googlePlaceId?: string | null;
  readonly pathId: string;
  readonly position: number;
  readonly parentPathId: string | null;
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

  if (node.kind === "folder") {
    return {
      ...base,
      kind: "folder",
      id: node.id,
      name: node.name,
      folderType: node.folderType ?? null,
      color: node.color ?? null,
    };
  }

  if (node.kind === "day") {
    return {
      ...base,
      kind: "day",
      id: node.id,
      name: node.name,
      color: node.color ?? null,
    };
  }

  if (node.kind === "activity") {
    return {
      ...base,
      kind: "activity",
      id: node.id,
      name: node.name,
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
      latitude: node.latitude ?? null,
      longitude: node.longitude ?? null,
      googlePlaceId: node.googlePlaceId ?? null,
    };
  }

  throw new TypeError(`Project node ${node.pathId} has an unsupported kind.`);
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
    `/api/v2/projects/${projectId}/nodes`,
  );

  return response.map(normalizeProjectNode);
}
