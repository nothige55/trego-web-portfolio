// 일정 데이터가 준비되기 전 화면
// 오류가 있으면 원인과 함께 연결 상태를 보여 주고, 없으면 적재 중임을 알림

import { ProjectRealtimeStatusBanner } from "@/app/realtime/project-realtime-provider";

export function ProjectPlannerFallbackScreen({ error }: { readonly error: Error | null }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-[#f6f6f7] p-6">
      <section className="w-full max-w-md rounded-2xl border bg-card p-6 text-center shadow-sm">
        {error ? (
          <>
            <h1 className="text-lg font-semibold">여행 일정을 불러오지 못했습니다.</h1>
            <p role="alert" className="mt-2 text-sm text-destructive">
              {error.message}
            </p>
            <div className="mt-4 flex justify-center">
              <ProjectRealtimeStatusBanner />
            </div>
          </>
        ) : (
          <p role="status" className="text-sm font-medium text-muted-foreground">
            여행 일정 데이터를 불러오는 중입니다.
          </p>
        )}
      </section>
    </main>
  );
}
