import { lazy, type ReactNode, Suspense } from "react";

import { PlannerModulePanel } from "@/features/planner/components/planner-module-panel";
import { PlannerSchedulePanel } from "@/features/planner/components/planner-schedule-panel";
import { usePlannerViewStore } from "@/features/planner/stores/planner-view-store";

type PlannerWorkspaceProps = {
  readonly chatContent?: ReactNode;
  readonly projectId: string;
};

const PlannerMap = lazy(async () => {
  const module = await import("@/features/planner/components/planner-map");
  return { default: module.PlannerMap };
});

function PlannerMapModuleLoading() {
  return (
    <section
      aria-label="지도 영역"
      className="relative h-full min-w-0 flex-1 overflow-hidden bg-[#eef1f3]"
    >
      <div className="absolute inset-0 flex items-center justify-center p-8">
        <p role="status" className="text-sm font-medium text-muted-foreground">
          지도 모듈을 불러오는 중입니다
        </p>
      </div>
    </section>
  );
}

// Planner route의 최상위 조합 컴포넌트다.
// 일정, 보조 모듈, 지도 영역을 배치하되 각 영역의 세부 동작은 하위 컴포넌트가 소유한다.
export function PlannerWorkspace({ chatContent, projectId }: PlannerWorkspaceProps) {
  const isModuleCollapsed = usePlannerViewStore((state) => state.isModuleCollapsed);

  return (
    <main
      aria-label="여행 일정 플래너"
      data-project-id={projectId}
      className="flex h-svh min-w-240 overflow-hidden bg-[#f6f6f7] text-foreground"
    >
      <PlannerSchedulePanel />
      {/* 접힌 패널은 DOM에서도 제거해 남은 공간을 지도 영역이 모두 사용하게 한다. */}
      {isModuleCollapsed ? null : <PlannerModulePanel chatContent={chatContent} />}
      <Suspense fallback={<PlannerMapModuleLoading />}>
        <PlannerMap />
      </Suspense>
    </main>
  );
}
