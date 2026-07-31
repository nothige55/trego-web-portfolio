import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ProjectRealtimeContext,
  useProjectRealtime,
} from "@/app/realtime/project-realtime-context";
import {
  createProjectRealtimeSession,
  type ProjectRealtimeSession,
  type ProjectRealtimeSessionSnapshot,
} from "@/app/realtime/project-realtime-session";
import {
  createSignalRClient,
  type SignalRClient,
  type SignalRClientOptions,
} from "@/lib/signalr-client";

export interface ProjectRealtimeProviderProps {
  readonly accessTokenFactory?: SignalRClientOptions["accessTokenFactory"];
  readonly children: ReactNode;
  readonly clientFactory?: (options: SignalRClientOptions) => SignalRClient;
  readonly onError?: (error: Error) => void;
  readonly projectId: string;
  readonly registerSubscriptions: (client: SignalRClient) => (() => void) | void;
  readonly resync: () => Promise<void>;
}

const INITIAL_SNAPSHOT: ProjectRealtimeSessionSnapshot = {
  error: null,
  isReady: false,
  status: "idle",
};

export function ProjectRealtimeProvider({
  projectId,
  ...providerProps
}: ProjectRealtimeProviderProps) {
  return (
    <ProjectRealtimeProviderInstance key={projectId} projectId={projectId} {...providerProps} />
  );
}

function ProjectRealtimeProviderInstance({
  accessTokenFactory,
  children,
  clientFactory = createSignalRClient,
  onError,
  projectId,
  registerSubscriptions,
  resync,
}: ProjectRealtimeProviderProps) {
  const sessionRef = useRef<ProjectRealtimeSession | null>(null);
  const [client] = useState(() => clientFactory({ accessTokenFactory }));
  const [snapshot, setSnapshot] = useState(INITIAL_SNAPSHOT);

  useEffect(() => {
    const session = createProjectRealtimeSession({
      client,
      onError,
      projectId,
      registerSubscriptions,
      resync,
    });
    sessionRef.current = session;
    const unsubscribe = session.subscribe(setSnapshot);
    void session.start().catch(() => undefined);

    return () => {
      unsubscribe();
      sessionRef.current = null;
      void session.stop();
    };
  }, [client, onError, projectId, registerSubscriptions, resync]);

  const retry = useCallback(
    () =>
      sessionRef.current?.retry() ?? Promise.reject(new Error("Realtime session is not ready.")),
    [],
  );
  const value = useMemo(() => ({ ...snapshot, client, retry }), [client, retry, snapshot]);

  return (
    <ProjectRealtimeContext.Provider value={value}>{children}</ProjectRealtimeContext.Provider>
  );
}

export function ProjectRealtimeStatusBanner() {
  const { error, isReady, retry, status } = useProjectRealtime();

  if (status === "connected" && isReady) {
    return null;
  }

  if (status === "disconnected" || error) {
    return (
      <div role="alert">
        <span>{error ? "실시간 동기화에 실패했습니다." : "실시간 연결이 끊겼습니다."}</span>
        <button type="button" onClick={() => void retry()}>
          다시 연결
        </button>
      </div>
    );
  }

  return (
    <div role="status">
      {status === "reconnecting" ? "실시간 연결을 복구하고 있습니다." : "실시간 연결 중입니다."}
    </div>
  );
}
