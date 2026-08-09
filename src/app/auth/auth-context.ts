import { createContext, useContext } from "react";

import type { AuthSession, LoginInput, RegisterInput } from "@/features/auth/types";
import type { ApiClient } from "@/lib/api-client";

export type AuthContextValue = {
  readonly client: ApiClient;
  readonly isSubmitting: boolean;
  readonly login: (input: LoginInput) => Promise<void>;
  readonly logout: () => void;
  readonly register: (input: RegisterInput) => Promise<void>;
  readonly session: AuthSession | null;
  readonly status: "loading" | "ready";
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return value;
}
