import { DemoPlannerPage } from "@/app/demo/demo-planner-page";

// 로그인과 백엔드 없이 바로 편집 가능한 일정을 연다. router에서 지연 로딩하므로
// 운영 경로의 번들에는 데모 서버 코드가 포함되지 않는다.
export function DemoRoute() {
  return <DemoPlannerPage />;
}
