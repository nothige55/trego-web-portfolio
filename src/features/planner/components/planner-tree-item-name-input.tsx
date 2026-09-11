// 폴더·Day 행의 이름을 제자리에서 바꾸는 입력칸
// 초안과 저장은 usePlannerNameEditing이 소유하고, 여기서는 Enter·Escape·blur를 전달만 함

import { useEffect, useRef } from "react";

import type { FlattenedPlannerNode } from "@/features/planner/types/planner-node";

// 편집 중에만 마운트되므로 포커스와 전체 선택은 마운트 시점에 한 번만 처리
// 목록의 다른 행과 폭이 어긋나지 않도록 원래 이름을 invisible 텍스트로 깔고 그 위에 겹쳐 놓음
export function PlannerTreeItemNameInput({
  node,
  value,
  onChange,
  onCancel,
  onCommit,
}: {
  readonly node: FlattenedPlannerNode;
  readonly value: string;
  readonly onChange: (name: string) => void;
  readonly onCancel: () => void;
  readonly onCommit: (node: FlattenedPlannerNode) => void;
}) {
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, []);

  return (
    <span className="relative min-w-0 flex-1">
      <span aria-hidden="true" className="invisible block truncate font-medium">
        {node.name || "\u00a0"}
      </span>
      <input
        ref={nameInputRef}
        aria-label={`${node.name} 이름`}
        value={value}
        className="absolute -inset-y-2 right-0 -left-2 h-[30px] min-w-0 rounded-lg bg-brand/10 px-2 text-sm leading-none font-medium ring-1 ring-brand outline-none ring-inset"
        onBlur={onCancel}
        onChange={(event) => onChange(event.target.value)}
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          event.stopPropagation();

          if (event.key === "Enter") {
            event.preventDefault();
            onCommit(node);
          } else if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
        onPointerDown={(event) => event.stopPropagation()}
      />
    </span>
  );
}
