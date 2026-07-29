import { describe, expect, it } from "vitest";

import { parseApiBaseUrl } from "@/config/env";

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
