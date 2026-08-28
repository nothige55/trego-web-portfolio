import { AlertTriangle, ArrowRight, Check, Eye, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type {
  AiPlannerProposal,
  AiPlannerProposalToolPart,
} from "@/features/ai-planner/types/ai-planner";

type AiPlannerProposalCardProps = {
  readonly onReject?: () => void;
  readonly proposal: AiPlannerProposal;
  readonly toolState?: AiPlannerProposalToolPart["state"];
};

export function AiPlannerProposalCard({
  onReject,
  proposal,
  toolState = "approval-requested",
}: AiPlannerProposalCardProps) {
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    () => new Set(proposal.operations.map((operation) => operation.id)),
  );
  const [isPreviewing, setIsPreviewing] = useState(false);
  const selectedCount = selectedIds.size;
  const selectedOperations = useMemo(
    () => proposal.operations.filter((operation) => selectedIds.has(operation.id)),
    [proposal.operations, selectedIds],
  );
  const isRejected = toolState === "output-denied";

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
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-sm font-semibold">일정 변경 제안</h3>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {isRejected ? "거절됨" : toolState === "approval-requested" ? "승인 필요" : "검토 중"}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{proposal.summary}</p>
        </div>
      </div>

      <div className={`mt-3 space-y-2 ${isRejected ? "opacity-55" : ""}`}>
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
                disabled={isRejected}
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

      {isRejected ? (
        <p role="status" className="mt-3 text-xs font-medium text-muted-foreground">
          이 변경안은 적용 대상에서 제외되었습니다.
        </p>
      ) : null}

      {!isRejected && isPreviewing && selectedOperations.length > 0 ? (
        <section
          aria-label="선택한 변경 미리보기"
          className="mt-3 rounded-lg border border-brand/25 bg-brand/5 p-2.5"
        >
          <p role="status" className="flex items-center gap-1.5 text-xs font-medium text-brand">
            <Check aria-hidden="true" className="size-3.5" />
            적용 전 diff · {selectedOperations.length}건
          </p>
          <div className="mt-2 space-y-2">
            {selectedOperations.map((operation) => (
              <article key={operation.id} className="rounded-md bg-background p-2">
                <p className="text-[11px] font-semibold">{operation.label}</p>
                <div className="mt-1 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 text-[10px] leading-4">
                  <span className="rounded bg-muted px-1.5 py-1 text-muted-foreground line-through decoration-muted-foreground/60">
                    {operation.before}
                  </span>
                  <ArrowRight aria-hidden="true" className="size-3 text-brand" />
                  <span className="rounded bg-brand/10 px-1.5 py-1 font-medium text-foreground">
                    {operation.after}
                  </span>
                </div>
              </article>
            ))}
          </div>
          <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
            아직 Planner와 서버에는 반영되지 않았습니다.
          </p>
        </section>
      ) : null}

      {!isRejected ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={selectedCount === 0}
            onClick={() => setIsPreviewing(true)}
          >
            <Eye aria-hidden="true" className="size-4" />
            변경 전후 미리보기
          </Button>
          <Button type="button" size="sm" disabled title="승인 실행 API 연결 후 사용할 수 있습니다">
            선택한 변경 적용
          </Button>
          {onReject ? (
            <Button type="button" variant="ghost" size="sm" onClick={onReject}>
              변경안 거절
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
