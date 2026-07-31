export interface CursorPoint {
  readonly x: number;
  readonly y: number;
}

export interface CursorRatios {
  readonly xRatio: number;
  readonly yRatio: number;
}

export interface PlannerBounds {
  readonly height: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
}

export interface RemoteCursor extends CursorRatios {
  readonly lastUpdatedAt: number;
  readonly userId: string;
}

export interface UpdateCursorCommand extends CursorRatios {
  readonly userId: string;
}

export interface CursorUpdatedEvent extends CursorRatios {
  readonly userId: string;
}
