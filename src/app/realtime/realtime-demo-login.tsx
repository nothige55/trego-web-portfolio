import { LogIn } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import type { ApiClient } from "@/lib/api-client";
import { apiClient } from "@/lib/api-client";

export interface RealtimeDemoIdentity {
  readonly accessToken: string;
  readonly email: string;
  readonly id: string;
  readonly name: string;
}

interface LoginResponse extends RealtimeDemoIdentity {
  readonly profileUrl?: string | null;
}

type RealtimeDemoLoginProps = {
  readonly client?: Pick<ApiClient, "post">;
  readonly onAuthenticated: (identity: RealtimeDemoIdentity) => void;
  readonly projectId: string;
};

export function RealtimeDemoLogin({
  client = apiClient,
  onAuthenticated,
  projectId,
}: RealtimeDemoLoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await client.post<LoginResponse, { email: string; password: string }>(
        "/api/auth/login",
        { email, password },
      );
      onAuthenticated({
        accessToken: response.accessToken,
        email: response.email,
        id: response.id,
        name: response.name,
      });
    } catch {
      setError("로그인하지 못했습니다. 기존 Trego 계정 정보를 확인해 주세요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section
      aria-labelledby="realtime-demo-login-title"
      className="flex h-full w-full flex-col justify-center rounded-xl border bg-muted/20 p-5"
    >
      <LogIn aria-hidden="true" className="size-7 text-brand" />
      <h2 id="realtime-demo-login-title" className="mt-4 text-base font-semibold">
        실시간 테스트 로그인
      </h2>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        기존 Trego 계정으로 로그인하면 프로젝트 {projectId}의 REST 데이터와 SignalR 세션을
        연결합니다. 인증 정보는 이 브라우저 탭에만 보관됩니다.
      </p>

      <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="realtime-demo-email" className="text-xs font-medium">
            이메일
          </label>
          <input
            id="realtime-demo-email"
            type="email"
            autoComplete="username"
            required
            value={email}
            className="mt-1 h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/15"
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="realtime-demo-password" className="text-xs font-medium">
            비밀번호
          </label>
          <input
            id="realtime-demo-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            className="mt-1 h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/15"
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        {error ? (
          <p role="alert" className="text-xs leading-5 text-destructive">
            {error}
          </p>
        ) : null}
        <Button
          type="submit"
          className="w-full bg-brand text-brand-foreground hover:bg-brand-hover"
          disabled={isSubmitting}
        >
          {isSubmitting ? "연결 준비 중…" : "로그인하고 연결"}
        </Button>
      </form>
    </section>
  );
}
