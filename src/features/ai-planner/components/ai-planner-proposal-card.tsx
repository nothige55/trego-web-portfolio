import { AlertTriangle, ArrowRight, Check, Eye, LoaderCircle, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type {
  AiPlannerOperationPreview,
  AiPlannerProposalPreview,
  AiPlannerProposalToolPart,
} from "@/features/ai-planner/types/ai-planner";

type AiPlannerProposalCardProps = {
  readonly canApprove?: boolean;
  readonly errorText?: string | null;
  readonly onApprove?: (operations: readonly AiPlannerOperationPreview[]) => void;
  readonly onReject?: () => void;
  readonly onRetry?: () => void;
  readonly proposal: AiPlannerProposalPreview;
  readonly toolState?: AiPlannerProposalToolPart["state"];
};

const statusLabels: Record<string, string> = {
  "approval-requested": "승인 필요",
  "approval-responded": "적용 중",
  "output-available": "적용됨",
  "output-denied": "거절됨",
  "output-error": "적용 실패",
};

export function AiPlannerProposalCard({
  canApprove = false,
  errorText,
  onApprove,
  onReject,
  onRetry,
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

  const isApplying = toolState === "approval-responded";
  const isApplied = toolState === "output-available";
  const isRejected = toolState === "output-denied";
  const isFailed = toolState === "output-error";
  const isActionable = !isApplying && !isApplied && !isRejected && !isFailed;

  return (
    <section
      aria-label="AI 일정 변경 제안"
      className="mt-2 rounded-xl border bg-card p-3 text-card-foreground"
    >
      <div className="flex items-start gap-2">
        <span
          aria-hidden="true"
          className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand"
        >
          <Sparkles aria-hidden="true" className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-sm font-semibold">일정 변경 제안</h3>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {statusLabels[toolState] ?? "검토 중"}
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
              className="flex cursor-pointer items-start gap-2 rounded-lg border p-2 text-xs"
            >
              <input
                type="checkbox"
                checked={isSelected}
                disabled={!isActionable}
                aria-label={`${operation.label} 선택`}
                className="mt-1 size-4 accent-brand"
                onChange={() => {
                  setSelectedIds((current) => {
                    const next = new Set(current);
                    if (next.has(operation.id)) {
                      next.delete(operation.id);
                    } else {
                      next.add(operation.id);
                    }
                    return next;
                  });
                }}
              />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{operation.label}</span>
                <span className="mt-0.5 block text-muted-foreground">{operation.reason}</span>
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
          className="mt-2 flex items-start gap-1 text-[11px] leading-4 text-amber-600 dark:text-amber-400"
        >
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
          {warning}
        </p>
      ))}

      {isApplied ? (
        <p role="status" className="mt-3 flex items-center gap-1.5 text-xs font-medium text-brand">
          <Check aria-hidden="true" className="size-3.5" />
          변경을 적용했습니다. 실행 결과는 다른 참여자에게도 전파됩니다.
        </p>
      ) : null}

      {isApplying ? (
        <p
          role="status"
          className="mt-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
        >
          <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin text-brand" />
          변경을 적용하는 중입니다
        </p>
      ) : null}

      {isRejected ? (
        <p role="status" className="mt-3 text-xs font-medium text-muted-foreground">
          이 변경안은 적용 대상에서 제외되었습니다.
        </p>
      ) : null}

      {isFailed ? (
        <p role="alert" className="mt-3 text-xs font-medium text-destructive">
          {errorText ?? "변경을 적용하지 못했습니다."}
        </p>
      ) : null}

      {isActionable && isPreviewing && selectedOperations.length > 0 ? (
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

      {isActionable ? (
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
          <Button
            type="button"
            size="sm"
            disabled={!canApprove || selectedCount === 0}
            title={canApprove ? undefined : "실시간 연결이 준비되면 사용할 수 있습니다"}
            onClick={() => onApprove?.(selectedOperations)}
          >
            선택한 변경 적용
          </Button>
          {onReject ? (
            <Button type="button" variant="ghost" size="sm" onClick={onReject}>
              변경안 거절
            </Button>
          ) : null}
        </div>
      ) : null}

      {isFailed && onRetry ? (
        <div className="mt-3">
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            다시 시도
          </Button>
        </div>
      ) : null}
    </section>
  );
}
