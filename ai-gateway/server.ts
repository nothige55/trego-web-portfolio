import { timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";

import { createOpenAI } from "@ai-sdk/openai";

import { aiPlannerChatRequestSchema, type AiPlannerStreamEvent } from "./contracts.js";
import { streamPlannerResponse } from "./planner-agent.js";

const MAX_REQUEST_BYTES = 1_000_000;

type GatewayConfig = {
  readonly apiKey?: string;
  readonly model: string;
  readonly port: number;
  readonly sharedSecret: string;
};

function getConfig(): GatewayConfig {
  const sharedSecret = process.env.AI_GATEWAY_SHARED_SECRET?.trim();
  if (!sharedSecret) throw new Error("AI_GATEWAY_SHARED_SECRET is required.");

  const port = Number(process.env.AI_GATEWAY_PORT ?? 8787);
  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    throw new Error("AI_GATEWAY_PORT must be a valid TCP port.");
  }

  return {
    apiKey: process.env.OPENAI_API_KEY?.trim() || undefined,
    model: process.env.OPENAI_MODEL?.trim() || "gpt-5.6-terra",
    port,
    sharedSecret,
  };
}

function isAuthorized(request: IncomingMessage, sharedSecret: string): boolean {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) return false;

  const providedSecret = Buffer.from(authorization.slice("Bearer ".length));
  const expectedSecret = Buffer.from(sharedSecret);
  return (
    providedSecret.length === expectedSecret.length &&
    timingSafeEqual(providedSecret, expectedSecret)
  );
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let byteLength = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    byteLength += buffer.length;
    if (byteLength > MAX_REQUEST_BYTES) throw new Error("REQUEST_TOO_LARGE");
    chunks.push(buffer);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function writeEvent(response: ServerResponse, event: AiPlannerStreamEvent): void {
  response.write(`${JSON.stringify(event)}\n`);
}

async function handlePlannerChat(
  request: IncomingMessage,
  response: ServerResponse,
  config: GatewayConfig,
): Promise<void> {
  if (!isAuthorized(request, config.sharedSecret)) {
    sendJson(response, 401, { error: "Unauthorized" });
    return;
  }

  if (!config.apiKey) {
    sendJson(response, 503, { error: "OPENAI_API_KEY is not configured." });
    return;
  }

  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    const statusCode = error instanceof Error && error.message === "REQUEST_TOO_LARGE" ? 413 : 400;
    sendJson(response, statusCode, { error: "Invalid JSON request body." });
    return;
  }

  const parsedRequest = aiPlannerChatRequestSchema.safeParse(body);
  if (!parsedRequest.success) {
    sendJson(response, 422, { error: "Invalid planner chat request." });
    return;
  }

  const abortController = new AbortController();
  response.on("close", () => {
    if (!response.writableEnded) abortController.abort();
  });
  response.writeHead(200, {
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "X-Accel-Buffering": "no",
  });

  const openai = createOpenAI({ apiKey: config.apiKey });
  try {
    for await (const event of streamPlannerResponse({
      abortSignal: abortController.signal,
      input: parsedRequest.data,
      model: openai.responses(config.model),
    })) {
      writeEvent(response, event);
    }
  } catch (error) {
    console.error("AI planner stream failed", error);
    if (!response.writableEnded) {
      writeEvent(response, { type: "error", message: "AI 응답을 완료하지 못했습니다." });
    }
  } finally {
    response.end();
  }
}

export function createGatewayServer(config: GatewayConfig) {
  return createServer((request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      sendJson(response, 200, {
        model: config.model,
        openAiConfigured: Boolean(config.apiKey),
        status: "ok",
      });
      return;
    }

    if (request.method === "POST" && request.url === "/v1/planner/chat") {
      void handlePlannerChat(request, response, config);
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = getConfig();
  const server = createGatewayServer(config);
  server.listen(config.port, "127.0.0.1", () => {
    console.warn(`Trego AI Gateway listening on http://127.0.0.1:${config.port}`);
  });
}
