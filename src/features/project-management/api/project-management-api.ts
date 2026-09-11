// 프로젝트 목록·생성·멤버 추가 REST 요청을 담당
// 기본 client를 두지 않아 호출부가 인증된 client를 넘겨야 함

import type {
  CreateProjectInput,
  ProjectMemberRole,
  ProjectSummary,
} from "@/features/project-management/types";
import type { ApiClient } from "@/lib/api-client";

export function getMyProjects(client: Pick<ApiClient, "get">): Promise<readonly ProjectSummary[]> {
  return client.get<readonly ProjectSummary[]>("/api/me/projects");
}

export async function createProject(
  input: CreateProjectInput,
  client: Pick<ApiClient, "post">,
): Promise<void> {
  await client.post<unknown, CreateProjectInput>("/api/projects", input);
}

export async function addProjectMember(
  projectId: string,
  memberEmail: string,
  role: ProjectMemberRole,
  client: Pick<ApiClient, "post">,
): Promise<void> {
  await client.post(`/api/projects/${projectId}/members`, { memberEmail, role });
}
