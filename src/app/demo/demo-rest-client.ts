import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";

import type { DemoNetwork } from "@/app/demo/demo-network";
import type { DemoProjectServer } from "@/app/demo/demo-project-server";
import { simulateLatency } from "@/app/demo/simulate-latency";
import { type ApiClient, createApiClient } from "@/lib/api-client";

const DEFAULT_LATENCY_MS = 150;

const PROJECT_DETAILS_PATTERN = /^\/api\/projects\/([^/]+)$/;
const PROJECT_NODES_PATTERN = /^\/api\/v2\/projects\/([^/]+)\/nodes$/;
const PROJECT_MESSAGES_PATTERN = /^\/api\/projects\/([^/]+)\/messages$/;
const PROJECT_MEMBERS_PATTERN = /^\/api\/projects\/([^/]+)\/members$/;

export interface DemoRestClientOptions {
  readonly latencyMs?: number;
  readonly network: DemoNetwork;
  readonly server: DemoProjectServer;
}

type DemoRestResult = {
  readonly data: unknown;
  readonly status: number;
};

function toResponse(
  config: InternalAxiosRequestConfig,
  { data, status }: DemoRestResult,
): AxiosResponse {
  return { config, data, headers: {}, request: {}, status, statusText: String(status) };
}

// Planner 화면이 부르는 REST 엔드포인트만 데모 서버의 기준 상태로 응답한다.
// axios adapter로 끼우므로 interceptor, 401 처리, response.data 추출은 운영 경로와 같다.
export function createDemoRestClient({
  latencyMs = DEFAULT_LATENCY_MS,
  network,
  server,
}: DemoRestClientOptions): ApiClient {
  function route(method: string, url: string): DemoRestResult {
    const { messages, nodes, project } = server.getSnapshot();
    const isCurrentProject = (match: RegExpMatchArray | null) => match?.[1] === project.publicId;

    if (method === "get" && isCurrentProject(url.match(PROJECT_DETAILS_PATTERN))) {
      return {
        status: 200,
        data: {
          ...project,
          startDate: `${project.startDate}T00:00:00Z`,
          endDate: `${project.endDate}T00:00:00Z`,
          createdAt: "2026-07-01T00:00:00Z",
          updatedAt: "2026-07-01T00:00:00Z",
          likeCount: 0,
          viewCount: 0,
          thumbnailUrl: "",
        },
      };
    }

    if (method === "get" && isCurrentProject(url.match(PROJECT_NODES_PATTERN))) {
      return { status: 200, data: nodes };
    }

    if (method === "get" && isCurrentProject(url.match(PROJECT_MESSAGES_PATTERN))) {
      return { status: 200, data: messages };
    }

    if (method === "post" && isCurrentProject(url.match(PROJECT_MEMBERS_PATTERN))) {
      return { status: 403, data: { message: "데모에서는 멤버를 초대할 수 없습니다." } };
    }

    return { status: 404, data: { message: "데모에서 지원하지 않는 요청입니다." } };
  }

  return createApiClient({
    async adapter(config) {
      await simulateLatency(latencyMs);

      if (!network.isOnline()) {
        throw new AxiosError("Network Error", AxiosError.ERR_NETWORK, config);
      }

      const response = toResponse(
        config,
        route((config.method ?? "get").toLowerCase(), config.url ?? ""),
      );

      if (response.status >= 400) {
        throw new AxiosError(
          `Request failed with status code ${response.status}`,
          AxiosError.ERR_BAD_REQUEST,
          config,
          response.request,
          response,
        );
      }

      return response;
    },
  });
}
