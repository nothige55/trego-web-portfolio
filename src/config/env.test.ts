import { describe, expect, it } from "vitest";

import { parseApiBaseUrl, parseSignalRHubUrl, resolveSignalRHubUrl } from "@/config/env";

describe("parseApiBaseUrl", () => {
  it("uses relative requests when the value is missing", () => {
    expect(parseApiBaseUrl(undefined)).toBeUndefined();
    expect(parseApiBaseUrl("  ")).toBeUndefined();
  });

  it("normalizes a configured API base URL", () => {
    expect(parseApiBaseUrl(" https://api.example.com/ ")).toBe("https://api.example.com");
  });

  it("rejects invalid or unsupported URLs", () => {
    expect(() => parseApiBaseUrl("api.example.com")).toThrow(
      "VITE_API_BASE_URL must be a valid absolute URL.",
    );
    expect(() => parseApiBaseUrl("ftp://api.example.com")).toThrow(
      "VITE_API_BASE_URL must use the http or https protocol.",
    );
  });
});

describe("parseSignalRHubUrl", () => {
  it("accepts root-relative and absolute hub URLs", () => {
    expect(parseSignalRHubUrl(" /project/ ")).toBe("/project");
    expect(parseSignalRHubUrl(" https://api.example.com/project/ ")).toBe(
      "https://api.example.com/project",
    );
  });

  it("rejects invalid or unsupported hub URLs", () => {
    expect(() => parseSignalRHubUrl("project")).toThrow(
      "VITE_SIGNALR_HUB_URL must be an absolute URL or a root-relative path.",
    );
    expect(() => parseSignalRHubUrl("ws://api.example.com/project")).toThrow(
      "VITE_SIGNALR_HUB_URL must use the http or https protocol.",
    );
  });
});

describe("resolveSignalRHubUrl", () => {
  it("prefers an explicitly configured hub URL", () => {
    expect(
      resolveSignalRHubUrl("https://realtime.example.com/project", "https://api.example.com"),
    ).toBe("https://realtime.example.com/project");
  });

  it("derives the hub URL from the API origin", () => {
    expect(resolveSignalRHubUrl(undefined, "https://api.example.com/api")).toBe(
      "https://api.example.com/project",
    );
  });

  it("uses the local proxy path when no URL is configured", () => {
    expect(resolveSignalRHubUrl(undefined, undefined)).toBe("/project");
  });
});
