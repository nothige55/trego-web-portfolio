import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { useAuth } from "@/app/auth/auth-context";
import { AuthScreen } from "@/features/auth/components/auth-screen";
import { HomeScreen } from "@/features/home/components/home-screen";
import type { CreateTripInput, HomeTripSummary } from "@/features/home/types";
import {
  createProject,
  getMyProjects,
} from "@/features/project-management/api/project-management-api";

function formatDateRange(startDate: string, endDate: string): string {
  const formatter = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  return `${formatter.format(new Date(startDate))} - ${formatter.format(new Date(endDate))}`;
}

export function RootRoute() {
  const { client, isSubmitting, login, logout, register, session, status } = useAuth();
  const navigate = useNavigate();
  const [recentTrips, setRecentTrips] = useState<readonly HomeTripSummary[]>([]);
  const [isAuthScreenVisible, setIsAuthScreenVisible] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    setIsLoadingProjects(true);
    setProjectError(null);

    try {
      const projects = await getMyProjects(client);
      setRecentTrips(
        projects.map((project) => ({
          id: project.publicId,
          title: project.title,
          dateLabel: formatDateRange(project.startDate, project.endDate),
        })),
      );
    } catch {
      setProjectError("프로젝트 목록을 불러오지 못했습니다.");
    } finally {
      setIsLoadingProjects(false);
    }
  }, [client]);

  useEffect(() => {
    if (session) {
      void Promise.resolve().then(loadProjects);
    }
  }, [loadProjects, session]);

  if (status === "loading") {
    return (
      <main className="flex min-h-svh items-center justify-center" role="status">
        로그인 정보를 확인하는 중입니다.
      </main>
    );
  }

  if (!session && isAuthScreenVisible) {
    return (
      <AuthScreen
        isSubmitting={isSubmitting}
        onBack={() => setIsAuthScreenVisible(false)}
        onLogin={login}
        onRegister={register}
      />
    );
  }

  async function handleCreateTrip(input: CreateTripInput) {
    if (!session) {
      setIsAuthScreenVisible(true);
      return;
    }

    setProjectError(null);

    try {
      await createProject(
        {
          ...input,
          rootPathId: crypto.randomUUID(),
        },
        client,
      );
      await loadProjects();
    } catch {
      setProjectError("프로젝트를 만들지 못했습니다.");
    }
  }

  return (
    <>
      <HomeScreen
        currentUserName={session?.name}
        recentTrips={session ? recentTrips : []}
        onLogin={session ? undefined : () => setIsAuthScreenVisible(true)}
        onLogout={session ? logout : undefined}
        onPromptSubmit={() => {
          if (!session) {
            setIsAuthScreenVisible(true);
          }
        }}
        onCreateTrip={(input) => void handleCreateTrip(input)}
        onTripSelect={(trip) => void navigate(`/planner/${trip.id}`)}
      />
      {isLoadingProjects || projectError ? (
        <div className="fixed right-4 bottom-4 z-50 rounded-xl border bg-card px-4 py-3 text-sm shadow-lg">
          {isLoadingProjects ? <p role="status">프로젝트를 불러오는 중입니다.</p> : null}
          {projectError ? (
            <p role="alert" className="text-destructive">
              {projectError}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
