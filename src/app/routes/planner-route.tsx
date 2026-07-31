import { useParams } from "react-router";

import { PlannerWorkspace } from "@/features/planner/components/planner-workspace";

// app route는 URL 해석과 feature 조합만 담당한다.
// projectTitle은 기존 URL 호환용이며, fixture 단계의 화면 데이터로 사용하지 않는다.
export function PlannerRoute() {
  const { projectId = "demo" } = useParams();

  return <PlannerWorkspace projectId={projectId} />;
}
