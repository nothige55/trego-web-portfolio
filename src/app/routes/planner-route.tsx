import { useState } from "react";
import { useParams } from "react-router";

import { PlannerRealtimeDemo } from "@/app/realtime/planner-realtime-demo";
import { type RealtimeDemoIdentity, RealtimeDemoLogin } from "@/app/realtime/realtime-demo-login";
import { PlannerWorkspace } from "@/features/planner/components/planner-workspace";

const REALTIME_IDENTITY_SESSION_KEY = "trego-realtime-demo-identity";

function isRealtimeDemoIdentity(value: unknown): value is RealtimeDemoIdentity {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<RealtimeDemoIdentity>;
  return [candidate.accessToken, candidate.email, candidate.id, candidate.name].every(
    (field) => typeof field === "string" && field.length > 0,
  );
}

function readStoredIdentity(): RealtimeDemoIdentity | null {
  try {
    const value = window.sessionStorage.getItem(REALTIME_IDENTITY_SESSION_KEY);
    const parsedValue: unknown = value ? JSON.parse(value) : null;
    return isRealtimeDemoIdentity(parsedValue) ? parsedValue : null;
  } catch {
    return null;
  }
}

// app route는 URL 해석과 feature 조합만 담당한다.
// projectTitle은 기존 URL 호환용이며, fixture 단계의 화면 데이터로 사용하지 않는다.
export function PlannerRoute() {
  const { projectId = "demo" } = useParams();
  const [identity, setIdentity] = useState(readStoredIdentity);

  function handleAuthenticated(nextIdentity: RealtimeDemoIdentity) {
    window.sessionStorage.setItem(REALTIME_IDENTITY_SESSION_KEY, JSON.stringify(nextIdentity));
    setIdentity(nextIdentity);
  }

  function handleLogout() {
    window.sessionStorage.removeItem(REALTIME_IDENTITY_SESSION_KEY);
    setIdentity(null);
  }

  if (identity) {
    return (
      <PlannerRealtimeDemo identity={identity} onLogout={handleLogout} projectId={projectId} />
    );
  }

  return (
    <PlannerWorkspace
      projectId={projectId}
      chatContent={
        <RealtimeDemoLogin projectId={projectId} onAuthenticated={handleAuthenticated} />
      }
    />
  );
}
