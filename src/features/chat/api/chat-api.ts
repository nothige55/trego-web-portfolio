// 프로젝트 채팅 이력의 REST 조회를 담당
// 초기 진입과 재동기화 때 app의 프로젝트 데이터 로더가 호출

import type { ChatMessage } from "@/features/chat/types/chat-message";
import type { ApiClient } from "@/lib/api-client";
import { apiClient } from "@/lib/api-client";

export async function getChatMessages(
  projectId: string,
  client: Pick<ApiClient, "get"> = apiClient,
): Promise<readonly ChatMessage[]> {
  return client.get<readonly ChatMessage[]>(`/api/projects/${projectId}/messages`);
}
