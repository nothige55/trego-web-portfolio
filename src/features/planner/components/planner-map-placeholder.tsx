import { ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePlannerViewStore } from "@/features/planner/stores/planner-view-store";

// Google Maps 연동 전까지 전체 레이아웃의 지도 자리만 보존한다.
// 이 컴포넌트에는 API key, 지도 SDK, Planner 상태 변경 로직을 추가하지 않는다.
export function PlannerMapPlaceholder() {
  const isModuleCollapsed = usePlannerViewStore((state) => state.isModuleCollapsed);
  const setModuleCollapsed = usePlannerViewStore((state) => state.setModuleCollapsed);

  return (
    <section
      aria-label="지도 영역"
      className="relative h-full min-w-0 flex-1 overflow-hidden bg-[#eef1f3]"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(to_right,#d9dee2_1px,transparent_1px),linear-gradient(to_bottom,#d9dee2_1px,transparent_1px)] bg-size-[32px_32px] opacity-35"
      />
      {isModuleCollapsed ? (
        <div className="absolute top-4 left-4">
          <Button
            type="button"
            variant="secondary"
            className="shadow-sm"
            onClick={() => {
              setModuleCollapsed(false);
            }}
          >
            <ChevronRight aria-hidden="true" className="size-4" />
            패널 열기
          </Button>
        </div>
      ) : null}
    </section>
  );
}
