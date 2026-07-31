import type {
  CursorPoint,
  CursorRatios,
  PlannerBounds,
} from "@/features/collaboration/types/cursor-presence";

function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number.`);
  }
}

function assertBounds(bounds: PlannerBounds): void {
  assertFinite(bounds.left, "Planner bounds left");
  assertFinite(bounds.top, "Planner bounds top");
  assertFinite(bounds.width, "Planner bounds width");
  assertFinite(bounds.height, "Planner bounds height");

  if (bounds.width <= 0 || bounds.height <= 0) {
    throw new RangeError("Planner bounds must have a positive width and height.");
  }
}

export function clampCursorRatio(value: number): number {
  assertFinite(value, "Cursor ratio");
  return Math.min(1, Math.max(0, value));
}

export function normalizeCursorPosition(point: CursorPoint, bounds: PlannerBounds): CursorRatios {
  assertFinite(point.x, "Cursor x coordinate");
  assertFinite(point.y, "Cursor y coordinate");
  assertBounds(bounds);

  return {
    xRatio: clampCursorRatio((point.x - bounds.left) / bounds.width),
    yRatio: clampCursorRatio((point.y - bounds.top) / bounds.height),
  };
}

export function denormalizeCursorPosition(
  ratios: CursorRatios,
  bounds: PlannerBounds,
): CursorPoint {
  assertBounds(bounds);

  return {
    x: bounds.left + clampCursorRatio(ratios.xRatio) * bounds.width,
    y: bounds.top + clampCursorRatio(ratios.yRatio) * bounds.height,
  };
}
