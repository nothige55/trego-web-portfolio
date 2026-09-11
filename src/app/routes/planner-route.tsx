// planner URL에서 projectId를 읽고, 인증 상태에 따라 로그인 화면이나 실시간 planner 페이지로 분기
// URL의 projectTitle은 기존 링크 호환용이라 읽지 않음

import { useParams } from "react-router";

import { useAuth } from "@/app/auth/auth-context";
import { ProjectPlannerPage } from "@/app/realtime/project-planner-page";
import { AuthScreen } from "@/features/auth/components/auth-screen";

export function PlannerRoute() {
  const { projectId = "demo" } = useParams();
  const { client, isSubmitting, login, register, session, status } = useAuth();

  if (status === "loading") {
    return (
      <main className="flex min-h-svh items-center justify-center" role="status">
        로그인 정보를 확인하는 중입니다.
      </main>
    );
  }

  if (!session) {
    return <AuthScreen isSubmitting={isSubmitting} onLogin={login} onRegister={register} />;
  }

  return <ProjectPlannerPage identity={session} projectId={projectId} restClient={client} />;
}
