import { createContext, useContext } from "react";

import type { ProjectRealtimeSessionSnapshot } from "@/app/realtime/project-realtime-session";
import type { SignalRClient } from "@/lib/signalr-client";

export interface ProjectRealtimeContextValue extends ProjectRealtimeSessionSnapshot {
  readonly client: SignalRClient | null;
  readonly retry: () => Promise<void>;
}

export const ProjectRealtimeContext = createContext<ProjectRealtimeContextValue | null>(null);

export function useProjectRealtime(): ProjectRealtimeContextValue {
  const context = useContext(ProjectRealtimeContext);

  if (!context) {
    throw new Error("useProjectRealtime must be used within ProjectRealtimeProvider.");
  }

  return context;
}
