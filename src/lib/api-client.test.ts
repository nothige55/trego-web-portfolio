import { AxiosError, AxiosHeaders, type AxiosResponse } from "axios";
import { describe, expect, it, vi } from "vitest";

import { createApiClient } from "@/lib/api-client";

function createResponse(
  config: AxiosResponse["config"],
  data: unknown = { ok: true },
): AxiosResponse {
  return {
    config,
    data,
    headers: {},
    status: 200,
    statusText: "OK",
  };
}

describe("createApiClient", () => {
  it("returns typed response data from the configured client", async () => {
    const client = createApiClient({ baseURL: "https://api.example.com" });
    client.raw.defaults.adapter = async (config) => createResponse(config);

    const response = await client.get<{ ok: boolean }>("/api/projects");

    expect(client.raw.defaults.baseURL).toBe("https://api.example.com");
    expect(response).toEqual({ ok: true });
  });

  it("adds a bearer token supplied by the caller", async () => {
    const client = createApiClient({ getAccessToken: () => "access-token" });
    let authorization: string | undefined;

    client.raw.defaults.adapter = async (config) => {
      authorization = AxiosHeaders.from(config.headers).get("Authorization")?.toString();
      return createResponse(config);
    };

    await client.get("/api/me");

    expect(authorization).toBe("Bearer access-token");
  });

  it("notifies the configured handlers when a request is unauthorized", async () => {
    const onError = vi.fn();
    const onUnauthorized = vi.fn();
    const client = createApiClient({ onError, onUnauthorized });
    const error = new AxiosError("Request failed", "ERR_BAD_RESPONSE", undefined, undefined, {
      config: { headers: new AxiosHeaders() },
      data: { message: "Authentication is required." },
      headers: {},
      status: 401,
      statusText: "Unauthorized",
    });

    client.raw.defaults.adapter = async () => {
      throw error;
    };

    await expect(client.get("/api/me")).rejects.toBe(error);
    expect(onUnauthorized).toHaveBeenCalledWith(error);
    expect(onError).toHaveBeenCalledWith(error);
  });
});
