import { useParams } from "react-router";

import { useAuth } from "@/app/auth/auth-context";
import { PlannerRealtimeDemo } from "@/app/realtime/planner-realtime-demo";
import { AuthScreen } from "@/features/auth/components/auth-screen";

// app route는 URL 해석과 feature 조합만 담당한다.
// projectTitle은 기존 URL 호환용이며, fixture 단계의 화면 데이터로 사용하지 않는다.
export function PlannerRoute() {
  const { projectId = "demo" } = useParams();
  const { client, isSubmitting, login, logout, register, session, status } = useAuth();

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

  return (
    <PlannerRealtimeDemo
      identity={session}
      onLogout={logout}
      projectId={projectId}
      restClient={client}
    />
  );
}
