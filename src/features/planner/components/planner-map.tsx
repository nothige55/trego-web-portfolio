import "mapbox-gl/dist/mapbox-gl.css";

import { ChevronRight, MapPinned, Scan } from "lucide-react";

import { Button } from "@/components/ui/button";
import { env } from "@/config/env";
import { usePlannerMapInstance } from "@/features/planner/hooks/use-planner-map-instance";
import { usePlannerViewStore } from "@/features/planner/stores/planner-view-store";

// 지도 영역의 화면 상태만 담당한다.
// mapbox-gl 인스턴스와 마커·경로 갱신은 usePlannerMapInstance와 planner/map 모듈이 소유한다.
export function PlannerMap({ accessToken }: { readonly accessToken?: string | null }) {
  const isModuleCollapsed = usePlannerViewStore((state) => state.isModuleCollapsed);
  const setModuleCollapsed = usePlannerViewStore((state) => state.setModuleCollapsed);
  const resolvedAccessToken = accessToken === undefined ? env.mapboxAccessToken : accessToken;
  const { mapContainerRef, mapLoadState, resetCamera, retry } =
    usePlannerMapInstance(resolvedAccessToken);

  return (
    <section
      aria-label="지도 영역"
      className="relative h-full min-w-0 flex-1 overflow-hidden bg-[#eef1f3]"
    >
      {resolvedAccessToken ? (
        <div className="absolute inset-0">
          <div ref={mapContainerRef} data-testid="planner-map-canvas" className="h-full w-full" />
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center p-8">
          <div className="max-w-sm rounded-xl border bg-card/95 p-5 text-center shadow-sm">
            <MapPinned aria-hidden="true" className="mx-auto mb-3 size-7 text-brand" />
            <p className="font-semibold">Mapbox 토큰이 필요합니다</p>
            <p className="mt-1 text-sm text-muted-foreground">
              VITE_MAPBOX_ACCESS_TOKEN을 설정하면 일정 마커와 경로가 표시됩니다.
            </p>
          </div>
        </div>
      )}
      {resolvedAccessToken && mapLoadState === "loading" ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#eef1f3]/85 p-8">
          <p role="status" className="text-sm font-medium text-muted-foreground">
            지도를 불러오는 중입니다
          </p>
        </div>
      ) : null}
      {resolvedAccessToken && mapLoadState === "error" ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#eef1f3]/95 p-8">
          <div
            role="alert"
            className="max-w-sm rounded-xl border bg-card p-5 text-center shadow-sm"
          >
            <MapPinned aria-hidden="true" className="mx-auto mb-3 size-7 text-brand" />
            <p className="font-semibold">지도를 불러오지 못했습니다</p>
            <p className="mt-1 text-sm text-muted-foreground">
              토큰과 네트워크 연결을 확인한 뒤 다시 시도해 주세요.
            </p>
            <Button type="button" variant="secondary" className="mt-4" onClick={retry}>
              지도 다시 시도
            </Button>
          </div>
        </div>
      ) : null}
      {resolvedAccessToken && mapLoadState === "ready" ? (
        <div className="absolute top-3 right-12 z-10">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            title="전체 일정 보기"
            aria-label="전체 일정 보기"
            className="shadow-sm"
            onClick={resetCamera}
          >
            <Scan aria-hidden="true" className="size-4" />
          </Button>
        </div>
      ) : null}
      {isModuleCollapsed ? (
        <div className="absolute top-4 left-4 z-10">
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
