import { describe, expect, it } from "vitest";

import { getPlannerRowIndentation } from "@/features/planner/utils/get-planner-row-indentation";

describe("getPlannerRowIndentation", () => {
  it("starts indenting from the first level below root", () => {
    expect(getPlannerRowIndentation(1)).toBe(0);
    expect(getPlannerRowIndentation(2)).toBe(30);
    expect(getPlannerRowIndentation(3)).toBe(60);
  });

  it("never indents backwards for root or unexpected depths", () => {
    expect(getPlannerRowIndentation(0)).toBe(0);
    expect(getPlannerRowIndentation(-1)).toBe(0);
  });
});
