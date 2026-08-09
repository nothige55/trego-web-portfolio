import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { AuthContext } from "@/app/auth/auth-context";
import {
  getCurrentMember,
  loginWithPassword,
  registerWithPassword,
} from "@/features/auth/api/auth-api";
import type { AuthSession, LoginInput, RegisterInput } from "@/features/auth/types";
import { apiClient, createApiClient } from "@/lib/api-client";

const ACCESS_TOKEN_SESSION_KEY = "trego-access-token";

function readAccessToken(): string | null {
  try {
    return window.sessionStorage.getItem(ACCESS_TOKEN_SESSION_KEY);
  } catch {
    return null;
  }
}

type AuthProviderProps = {
  readonly children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [accessToken, setAccessToken] = useState(readAccessToken);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [status, setStatus] = useState<"loading" | "ready">(accessToken ? "loading" : "ready");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const clearSession = useCallback(() => {
    window.sessionStorage.removeItem(ACCESS_TOKEN_SESSION_KEY);
    setAccessToken(null);
    setSession(null);
    setStatus("ready");
  }, []);
  const client = useMemo(
    () =>
      createApiClient({
        getAccessToken: () => accessToken,
        onUnauthorized: clearSession,
      }),
    [accessToken, clearSession],
  );

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    let isActive = true;

    void getCurrentMember(client)
      .then((member) => {
        if (isActive) {
          setSession({ ...member, accessToken });
          setStatus("ready");
        }
      })
      .catch(() => {
        if (isActive) {
          clearSession();
        }
      });

    return () => {
      isActive = false;
    };
  }, [accessToken, clearSession, client]);

  const authenticate = useCallback(async (input: LoginInput) => {
    const nextAccessToken = await loginWithPassword(input, apiClient);
    const authorizedClient = createApiClient({ getAccessToken: () => nextAccessToken });
    const member = await getCurrentMember(authorizedClient);
    window.sessionStorage.setItem(ACCESS_TOKEN_SESSION_KEY, nextAccessToken);
    setAccessToken(nextAccessToken);
    setSession({ ...member, accessToken: nextAccessToken });
    setStatus("ready");
  }, []);

  const login = useCallback(
    async (input: LoginInput) => {
      setIsSubmitting(true);
      try {
        await authenticate(input);
      } finally {
        setIsSubmitting(false);
      }
    },
    [authenticate],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      setIsSubmitting(true);
      try {
        await registerWithPassword(input, apiClient);
        await authenticate({ email: input.email, password: input.password });
      } finally {
        setIsSubmitting(false);
      }
    },
    [authenticate],
  );

  const value = useMemo(
    () => ({
      client,
      isSubmitting,
      login,
      logout: clearSession,
      register,
      session,
      status,
    }),
    [clearSession, client, isSubmitting, login, register, session, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
