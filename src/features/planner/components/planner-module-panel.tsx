import { ChevronLeft, Compass, MessageSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  type PlannerModule,
  usePlannerViewStore,
} from "@/features/planner/stores/planner-view-store";

const modules: Array<{
  readonly value: PlannerModule;
  readonly label: string;
  readonly icon: typeof Compass;
}> = [
  { value: "explore", label: "탐색", icon: Compass },
  { value: "chat", label: "채팅", icon: MessageSquare },
];

// 기존 Planner의 두 번째 패널 구조를 보존하는 임시 shell이다.
// 실제 Explore와 Chat feature는 각 기능 이식 단계에서 app 조합을 통해 연결한다.
export function PlannerModulePanel() {
  const activeModule = usePlannerViewStore((state) => state.activeModule);
  const setActiveModule = usePlannerViewStore((state) => state.setActiveModule);
  const setModuleCollapsed = usePlannerViewStore((state) => state.setModuleCollapsed);

  return (
    <aside
      aria-label="Planner 보조 패널"
      className="z-10 flex h-full w-90 shrink-0 flex-col border-r bg-card shadow-[12px_0_20px_-14px_rgba(0,0,0,0.22)]"
    >
      <header className="flex h-12 items-center border-b px-2">
        <nav aria-label="Planner 도구" className="flex flex-1 items-center gap-1">
          {modules.map(({ value, label, icon }) => {
            const isActive = activeModule === value;
            const ModuleIcon = icon;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={isActive}
                className={`flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
                onClick={() => {
                  setActiveModule(value);
                }}
              >
                <ModuleIcon aria-hidden="true" className="size-4" />
                {label}
              </button>
            );
          })}
        </nav>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="보조 패널 접기"
          onClick={() => {
            setModuleCollapsed(true);
          }}
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 p-4">
        <div className="flex h-full w-full flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-8 text-center">
          {activeModule === "explore" ? (
            <>
              <Compass aria-hidden="true" className="size-7 text-brand" />
              <h2 className="mt-4 text-sm font-semibold">장소 탐색을 준비 중입니다</h2>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Google Places 검색은 지도 연동 단계에서 연결합니다.
              </p>
            </>
          ) : (
            <>
              <MessageSquare aria-hidden="true" className="size-7 text-brand" />
              <h2 className="mt-4 text-sm font-semibold">여행 채팅을 준비 중입니다</h2>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                실시간 메시지는 SignalR 연동 단계에서 연결합니다.
              </p>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
