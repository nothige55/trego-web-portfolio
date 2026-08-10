import { describe, expect, it } from "vitest";

import {
  denormalizeCursorPosition,
  normalizeCursorPosition,
} from "@/features/collaboration/utils/cursor-coordinates";

const plannerBounds = {
  left: 100,
  top: 50,
  width: 400,
  height: 200,
};

describe("cursor coordinate transformations", () => {
  it("normalizes viewport coordinates relative to the Planner bounds", () => {
    expect(normalizeCursorPosition({ x: 300, y: 100 }, plannerBounds)).toEqual({
      xRatio: 0.5,
      yRatio: 0.25,
    });
  });

  it("denormalizes ratios for the current Planner bounds", () => {
    expect(denormalizeCursorPosition({ xRatio: 0.5, yRatio: 0.25 }, plannerBounds)).toEqual({
      x: 300,
      y: 100,
    });
  });

  it("clamps positions outside the Planner to its edges", () => {
    expect(normalizeCursorPosition({ x: 50, y: 300 }, plannerBounds)).toEqual({
      xRatio: 0,
      yRatio: 1,
    });
    expect(denormalizeCursorPosition({ xRatio: 2, yRatio: -1 }, plannerBounds)).toEqual({
      x: 500,
      y: 50,
    });
  });

  it("rejects bounds that cannot produce stable ratios", () => {
    expect(() =>
      normalizeCursorPosition({ x: 100, y: 100 }, { left: 0, top: 0, width: 0, height: 100 }),
    ).toThrow("Planner bounds must have a positive width and height.");
  });
});
