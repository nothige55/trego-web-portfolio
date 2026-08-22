import { ChevronLeft, ChevronRight, Group, Pencil, Trash2 } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { useState } from "react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { PLANNER_DAY_COLORS } from "@/features/planner/data/planner-day-colors";
import type { PlannerNodeEditingCommands } from "@/features/planner/types/planner-editing-commands";
import type {
  FlattenedPlannerNode,
  PlannerNodePathId,
} from "@/features/planner/types/planner-node";

const VISIBLE_DAY_COLOR_COUNT = 4;

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

// 행 우클릭 메뉴다. 열릴 때마다 색상 스트립을 현재 색 기준으로 되돌려야 하므로
// 메뉴 내용만이 아니라 트리거를 포함한 ContextMenu 전체를 이 컴포넌트가 소유한다.
export function PlannerTreeItemContextMenu({
  node,
  commands,
  operationPathIds,
  trigger,
  onBeginEditing,
  children,
}: {
  readonly node: FlattenedPlannerNode;
  readonly commands?: PlannerNodeEditingCommands;
  readonly operationPathIds: readonly PlannerNodePathId[];
  readonly trigger: ReactElement;
  readonly onBeginEditing: (node: FlattenedPlannerNode) => void;
  readonly children: ReactNode;
}) {
  const currentDayColorIndex = PLANNER_DAY_COLORS.findIndex((color) => color === node.color);
  const [dayColorStartIndex, setDayColorStartIndex] = useState(currentDayColorIndex);
  const canRename = node.kind === "folder" || node.kind === "day";
  const visibleDayColors = Array.from(
    { length: VISIBLE_DAY_COLOR_COUNT },
    (_, offset) =>
      PLANNER_DAY_COLORS[modulo(dayColorStartIndex + offset, PLANNER_DAY_COLORS.length)],
  );

  return (
    <ContextMenu
      onOpenChange={(isOpen) => {
        if (isOpen) {
          setDayColorStartIndex(currentDayColorIndex);
        }
      }}
    >
      <ContextMenuTrigger render={trigger}>{children}</ContextMenuTrigger>
      {commands ? (
        <ContextMenuContent className="z-100">
          {canRename ? (
            <ContextMenuItem onClick={() => onBeginEditing(node)}>
              <Pencil aria-hidden="true" />
              이름 변경
            </ContextMenuItem>
          ) : null}
          {node.kind === "activity" ? (
            <ContextMenuItem onClick={() => commands.editActivityMemo?.(node.pathId)}>
              <Pencil aria-hidden="true" />
              메모 편집
            </ContextMenuItem>
          ) : null}
          {operationPathIds.length >= 2 && commands.groupNodes ? (
            <ContextMenuItem
              onClick={() => void commands.groupNodes?.(operationPathIds).catch(() => undefined)}
            >
              <Group aria-hidden="true" />
              선택 일정 그룹화
            </ContextMenuItem>
          ) : null}
          {node.kind === "day" ? (
            <div aria-label="Day 색상 선택" className="flex items-center gap-1 p-1" role="group">
              <ContextMenuItem
                aria-label="이전 Day 색상"
                className="size-8 justify-center rounded-full p-1"
                closeOnClick={false}
                onClick={() => setDayColorStartIndex((current) => current - 1)}
              >
                <ChevronLeft aria-hidden="true" />
              </ContextMenuItem>
              <div className="flex items-center gap-2">
                {visibleDayColors.map((color) => (
                  <ContextMenuItem
                    key={color}
                    aria-label={`색상 ${color} 선택`}
                    className="size-6 justify-center p-1"
                    closeOnClick={false}
                    onClick={() => {
                      void commands
                        .updateDay({ id: node.id, name: node.name, color })
                        .catch(() => undefined);
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className={`size-4 rounded-sm ${node.color === color ? "ring-2 ring-foreground ring-offset-1" : ""}`}
                      style={{ backgroundColor: color }}
                    />
                  </ContextMenuItem>
                ))}
              </div>
              <ContextMenuItem
                aria-label="다음 Day 색상"
                className="size-8 justify-center rounded-full p-1"
                closeOnClick={false}
                onClick={() => setDayColorStartIndex((current) => current + 1)}
              >
                <ChevronRight aria-hidden="true" />
              </ContextMenuItem>
            </div>
          ) : null}
          {canRename ? <ContextMenuSeparator /> : null}
          <ContextMenuItem
            variant="destructive"
            onClick={() => {
              const operation = commands.deleteNodes
                ? commands.deleteNodes(operationPathIds)
                : commands.deleteNode({ pathId: node.pathId });
              void operation.catch(() => undefined);
            }}
          >
            <Trash2 aria-hidden="true" />
            {operationPathIds.length > 1 ? `${operationPathIds.length}개 삭제` : "삭제"}
          </ContextMenuItem>
        </ContextMenuContent>
      ) : null}
    </ContextMenu>
  );
}
