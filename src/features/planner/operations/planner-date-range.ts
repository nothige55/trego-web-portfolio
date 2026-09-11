// 여행 기간 변경과 Day 삭제를 redo/undo 커맨드로 만들어 Day 수와 여행 기간을 함께 맞춤
// 기간을 바꾸면 Day를 늘리거나 줄이고 자동 이름을 다시 매기며, Day를 지우면 종료일을 당김

import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";

import {
  buildDeleteHistoryOperations,
  type PlannerOperationCommand,
} from "@/features/planner/operations/planner-operation-command";
import type { PlannerNode, PlannerNodePathId } from "@/features/planner/types/planner-node";
import type { PlannerProjectDetails } from "@/features/planner/types/planner-project";

const DAY_POSITION_STEP = 0.1;
const AUTOMATIC_DAY_NAME_PATTERN = /^\d{1,2}월 \d{1,2}일$/;

export interface PlannerDateRangeInput {
  readonly endDate: string;
  readonly startDate: string;
}

export interface PlannerDateRangeChangeSummary {
  readonly removedActivityCount: number;
  readonly removedDayCount: number;
  readonly targetDayCount: number;
}

export interface PlannerDateRangeHistory {
  readonly redo: readonly PlannerOperationCommand[];
  readonly summary: PlannerDateRangeChangeSummary;
  readonly undo: readonly PlannerOperationCommand[];
}

export interface PlannerDeleteHistory {
  readonly redo: readonly PlannerOperationCommand[];
  readonly undo: readonly PlannerOperationCommand[];
}

function createId(): string {
  return globalThis.crypto.randomUUID();
}

function getOrderedDays(
  nodes: readonly PlannerNode[],
  orderedPathIds: readonly PlannerNodePathId[],
): readonly Extract<PlannerNode, { kind: "day" }>[] {
  const nodeByPathId = new Map(nodes.map((node) => [node.pathId, node]));

  return orderedPathIds
    .map((pathId) => nodeByPathId.get(pathId))
    .filter((node): node is Extract<PlannerNode, { kind: "day" }> => node?.kind === "day");
}

function getTargetDayCount(input: PlannerDateRangeInput): number {
  const startDate = parseISO(input.startDate);
  const endDate = parseISO(input.endDate);
  const dayCount = differenceInCalendarDays(endDate, startDate) + 1;

  if (!Number.isFinite(dayCount) || dayCount < 1) {
    throw new Error("종료일은 시작일보다 빠를 수 없습니다.");
  }

  return dayCount;
}

function getDescendantPathIds(
  nodes: readonly PlannerNode[],
  rootPathIds: readonly PlannerNodePathId[],
): ReadonlySet<PlannerNodePathId> {
  const descendantPathIds = new Set(rootPathIds);
  let changed = true;

  while (changed) {
    changed = false;
    nodes.forEach((node) => {
      if (
        node.parentPathId &&
        descendantPathIds.has(node.parentPathId) &&
        !descendantPathIds.has(node.pathId)
      ) {
        descendantPathIds.add(node.pathId);
        changed = true;
      }
    });
  }

  return descendantPathIds;
}

export function getPlannerDateRangeChangeSummary(
  nodes: readonly PlannerNode[],
  orderedPathIds: readonly PlannerNodePathId[],
  input: PlannerDateRangeInput,
): PlannerDateRangeChangeSummary {
  const days = getOrderedDays(nodes, orderedPathIds);
  const targetDayCount = getTargetDayCount(input);
  const removedDays = days.slice(targetDayCount);
  const removedPathIds = getDescendantPathIds(
    nodes,
    removedDays.map((day) => day.pathId),
  );

  return {
    removedActivityCount: nodes.filter(
      (node) => node.kind === "activity" && removedPathIds.has(node.pathId),
    ).length,
    removedDayCount: removedDays.length,
    targetDayCount,
  };
}

export function buildPlannerDeleteHistory({
  nodes,
  pathIds,
  projectDetails,
}: Readonly<{
  nodes: readonly PlannerNode[];
  pathIds: readonly PlannerNodePathId[];
  projectDetails: PlannerProjectDetails;
}>): PlannerDeleteHistory {
  const deletedHistory = buildDeleteHistoryOperations(nodes, pathIds);
  const deletedPathIds = getDescendantPathIds(nodes, pathIds);
  const deletedDayCount = nodes.filter(
    (node) => node.kind === "day" && deletedPathIds.has(node.pathId),
  ).length;

  if (deletedDayCount === 0) return deletedHistory;

  const remainingDayCount = nodes.filter((node) => node.kind === "day").length - deletedDayCount;
  const nextEndDate = format(
    addDays(parseISO(projectDetails.startDate), Math.max(0, remainingDayCount - 1)),
    "yyyy-MM-dd",
  );
  const nextProject = { ...projectDetails, endDate: nextEndDate };

  return {
    redo: [...deletedHistory.redo, { type: "update-project", input: nextProject }],
    undo: [...deletedHistory.undo, { type: "update-project", input: projectDetails }],
  };
}

function getDayName(startDate: string, index: number): string {
  return format(addDays(parseISO(startDate), index), "M월 d일");
}

function isAutomaticDayName(name: string): boolean {
  return AUTOMATIC_DAY_NAME_PATTERN.test(name);
}

export function buildPlannerDateRangeHistory({
  input,
  nodes,
  orderedPathIds,
  projectDetails,
  rootPathId,
}: Readonly<{
  input: PlannerDateRangeInput;
  nodes: readonly PlannerNode[];
  orderedPathIds: readonly PlannerNodePathId[];
  projectDetails: PlannerProjectDetails;
  rootPathId: PlannerNodePathId;
}>): PlannerDateRangeHistory {
  const days = getOrderedDays(nodes, orderedPathIds);
  const summary = getPlannerDateRangeChangeSummary(nodes, orderedPathIds, input);
  const retainedDays = days.slice(0, summary.targetDayCount);
  const removedDays = days.slice(summary.targetDayCount);
  const addedDayCount = Math.max(0, summary.targetDayCount - days.length);
  const lastRootPosition = nodes
    .filter((node) => node.parentPathId === rootPathId)
    .reduce((maximum, node) => Math.max(maximum, node.position), 0);
  const createdDays = Array.from({ length: addedDayCount }, (_, offset) => {
    const dayIndex = days.length + offset;
    return {
      id: createId(),
      name: getDayName(input.startDate, dayIndex),
      pathId: createId(),
      parentPathId: rootPathId,
      position: lastRootPosition + DAY_POSITION_STEP * (offset + 1),
      color: "#F44336",
    };
  });
  const renamedDays = retainedDays.flatMap((day, index) => {
    const nextName = getDayName(input.startDate, index);
    return isAutomaticDayName(day.name) && nextName !== day.name ? [{ day, nextName }] : [];
  });
  const deletedHistory = buildDeleteHistoryOperations(
    nodes,
    removedDays.map((day) => day.pathId),
  );
  const nextProject = { ...projectDetails, ...input };

  return {
    summary,
    redo: [
      { type: "update-project", input: nextProject },
      ...renamedDays.map(({ day, nextName }) => ({
        type: "update-day" as const,
        input: { id: day.id, name: nextName, color: day.color ?? "#F44336" },
      })),
      ...createdDays.map((day) => ({ type: "create-day" as const, input: day })),
      ...deletedHistory.redo,
    ],
    undo: [
      { type: "update-project", input: projectDetails },
      ...renamedDays.map(({ day }) => ({
        type: "update-day" as const,
        input: { id: day.id, name: day.name, color: day.color ?? "#F44336" },
      })),
      ...createdDays.map((day) => ({
        type: "delete-node" as const,
        input: { pathId: day.pathId },
      })),
      ...deletedHistory.undo,
    ],
  };
}
