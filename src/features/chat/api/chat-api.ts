import type { ChatMessage } from "@/features/chat/types/chat-message";
import type { ApiClient } from "@/lib/api-client";
import { apiClient } from "@/lib/api-client";

export async function getChatMessages(
  projectId: string,
  client: Pick<ApiClient, "get"> = apiClient,
): Promise<readonly ChatMessage[]> {
  return client.get<readonly ChatMessage[]>(`/api/projects/${projectId}/messages`);
}
