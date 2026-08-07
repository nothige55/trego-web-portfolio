import { useEffect } from "react";

import { PlannerMap } from "@/features/planner/components/planner-map";
import { PlannerModulePanel } from "@/features/planner/components/planner-module-panel";
import { PlannerSchedulePanel } from "@/features/planner/components/planner-schedule-panel";
import { demoPlannerProject } from "@/features/planner/data/demo-planner";
import { usePlannerMapStore } from "@/features/planner/stores/planner-map-store";
import { usePlannerViewStore } from "@/features/planner/stores/planner-view-store";

type PlannerWorkspaceProps = {
  readonly projectId: string;
};

// Planner route의 최상위 조합 컴포넌트다.
// 일정, 보조 모듈, 지도 영역을 배치하되 각 영역의 세부 동작은 하위 컴포넌트가 소유한다.
export function PlannerWorkspace({ projectId }: PlannerWorkspaceProps) {
  const load = usePlannerViewStore((state) => state.load);
  const reset = usePlannerViewStore((state) => state.reset);
  const resetMap = usePlannerMapStore((state) => state.reset);
  const isModuleCollapsed = usePlannerViewStore((state) => state.isModuleCollapsed);

  useEffect(() => {
    // 실제 API가 연결되기 전에는 동일 fixture로 UI와 탐색 상태를 결정론적으로 검증한다.
    resetMap();
    load(demoPlannerProject.nodes);

    return () => {
      // 다른 프로젝트나 route로 이동할 때 이전 선택과 펼침 상태가 남지 않게 한다.
      reset();
      resetMap();
    };
  }, [load, projectId, reset, resetMap]);

  return (
    <main
      aria-label="여행 일정 플래너"
      data-project-id={projectId}
      className="flex h-svh min-w-240 overflow-hidden bg-[#f6f6f7] text-foreground"
    >
      <PlannerSchedulePanel />
      {/* 접힌 패널은 DOM에서도 제거해 남은 공간을 지도 영역이 모두 사용하게 한다. */}
      {isModuleCollapsed ? null : <PlannerModulePanel />}
      <PlannerMap />
    </main>
  );
}
