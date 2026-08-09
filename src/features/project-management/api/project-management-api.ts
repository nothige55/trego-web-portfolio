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
