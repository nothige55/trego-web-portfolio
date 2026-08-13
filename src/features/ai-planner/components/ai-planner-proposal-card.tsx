import { AlertTriangle, Check, Eye, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { AiPlannerProposal } from "@/features/ai-planner/types/ai-planner";

type AiPlannerProposalCardProps = {
  readonly proposal: AiPlannerProposal;
};

export function AiPlannerProposalCard({ proposal }: AiPlannerProposalCardProps) {
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    () => new Set(proposal.operations.map((operation) => operation.id)),
  );
  const [isPreviewing, setIsPreviewing] = useState(false);
  const selectedCount = selectedIds.size;
  const selectedOperations = useMemo(
    () => proposal.operations.filter((operation) => selectedIds.has(operation.id)),
    [proposal.operations, selectedIds],
  );

  return (
    <section
      aria-label="AI 일정 변경 제안"
      className={`mt-3 rounded-xl border bg-background p-3 transition-colors ${
        isPreviewing ? "border-brand ring-2 ring-brand/15" : "border-border"
      }`}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 rounded-md bg-brand/10 p-1.5 text-brand">
          <Sparkles aria-hidden="true" className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">일정 변경 제안</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{proposal.summary}</p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {proposal.operations.map((operation) => {
          const isSelected = selectedIds.has(operation.id);

          return (
            <label
              key={operation.id}
              className="flex cursor-pointer items-start gap-2 rounded-lg border bg-card p-2.5"
            >
              <input
                type="checkbox"
                checked={isSelected}
                aria-label={`${operation.label} 선택`}
                className="mt-1 size-4 accent-brand"
                onChange={() => {
                  setSelectedIds((current) => {
                    const next = new Set(current);
                    if (next.has(operation.id)) next.delete(operation.id);
                    else next.add(operation.id);
                    return next;
                  });
                }}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold">{operation.label}</span>
                <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">
                  {operation.before} → {operation.after}
                </span>
                <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">
                  {operation.reason}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      {proposal.assumptions.map((assumption) => (
        <p key={assumption} className="mt-2 text-[11px] leading-4 text-muted-foreground">
          가정: {assumption}
        </p>
      ))}
      {proposal.warnings.map((warning) => (
        <p
          key={warning}
          role="note"
          className="mt-2 flex items-start gap-1.5 text-[11px] leading-4 text-amber-700"
        >
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
          {warning}
        </p>
      ))}

      {isPreviewing ? (
        <p role="status" className="mt-3 flex items-center gap-1.5 text-xs font-medium text-brand">
          <Check aria-hidden="true" className="size-3.5" />
          선택한 변경 {selectedOperations.length}건의 미리보기가 준비되었습니다.
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={selectedCount === 0}
          onClick={() => setIsPreviewing(true)}
        >
          <Eye aria-hidden="true" className="size-4" />
          일정에서 미리보기
        </Button>
        <Button type="button" size="sm" disabled title="승인 실행 API 연결 후 사용할 수 있습니다">
          선택한 변경 적용
        </Button>
      </div>
    </section>
  );
}
