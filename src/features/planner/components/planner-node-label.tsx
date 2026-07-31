import type { MouseEventHandler, ReactNode } from "react";

import { PlannerNodeIcon } from "@/features/planner/components/planner-node-icons";
import type { FlattenedPlannerNode } from "@/features/planner/types/planner-node";
import { cn } from "@/lib/utils";

type PlannerNodeLabelProps = {
  readonly node: FlattenedPlannerNode;
  readonly parent?: FlattenedPlannerNode;
  readonly dayNumber?: number;
  readonly className?: string;
  readonly titleClassName?: string;
  readonly trailing?: ReactNode;
  readonly onClick?: MouseEventHandler<HTMLButtonElement>;
};

// 트리 행, breadcrumb, 루트 경계 라벨이 같은 아이콘·간격·타이포그래피를 사용한다.
export function PlannerNodeLabel({
  node,
  parent,
  dayNumber,
  className,
  titleClassName,
  trailing,
  onClick,
}: PlannerNodeLabelProps) {
  const content = (
    <>
      <PlannerNodeIcon node={node} parent={parent} dayNumber={dayNumber} />
      <span className={cn("truncate font-medium", titleClassName)}>{node.name}</span>
      {trailing}
    </>
  );
  const labelClassName = cn(
    "flex min-w-0 items-center gap-2 text-left text-sm leading-none",
    className,
  );

  if (onClick) {
    return (
      <button type="button" className={labelClassName} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <div className={labelClassName}>{content}</div>;
}
