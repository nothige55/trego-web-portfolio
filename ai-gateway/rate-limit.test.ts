import { describe, expect, it } from "vitest";

import { createRateLimiter } from "./rate-limit.js";

describe("createRateLimiter", () => {
  it("allows requests up to the limit inside one window", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 1_000 });

    expect(limiter.consume("member-1", 0)).toBe(true);
    expect(limiter.consume("member-1", 100)).toBe(true);
    expect(limiter.consume("member-1", 200)).toBe(false);
  });

  it("counts each member separately", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1_000 });

    expect(limiter.consume("member-1", 0)).toBe(true);
    expect(limiter.consume("member-2", 0)).toBe(true);
    expect(limiter.consume("member-1", 0)).toBe(false);
  });

  it("starts a fresh window once the previous one expires", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1_000 });

    expect(limiter.consume("member-1", 0)).toBe(true);
    expect(limiter.consume("member-1", 999)).toBe(false);
    expect(limiter.consume("member-1", 1_000)).toBe(true);
  });
});
