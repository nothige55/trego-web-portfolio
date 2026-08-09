import { ArrowLeft, LogIn, UserPlus } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import type { LoginInput, RegisterInput } from "@/features/auth/types";

type AuthMode = "login" | "register";

type AuthScreenProps = {
  readonly isSubmitting: boolean;
  readonly onBack?: () => void;
  readonly onLogin: (input: LoginInput) => Promise<void>;
  readonly onRegister: (input: RegisterInput) => Promise<void>;
};

export function AuthScreen({ isSubmitting, onBack, onLogin, onRegister }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      if (mode === "register") {
        await onRegister({ name: name.trim(), email: email.trim(), password });
      } else {
        await onLogin({ email: email.trim(), password });
      }
    } catch {
      setError(
        mode === "register"
          ? "회원가입하지 못했습니다. 입력 정보와 이메일 중복 여부를 확인해 주세요."
          : "로그인하지 못했습니다. 이메일과 비밀번호를 확인해 주세요.",
      );
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-10">
      <section
        aria-labelledby="auth-title"
        className="w-full max-w-md rounded-3xl border bg-card p-6 shadow-xl shadow-brand/5 sm:p-8"
      >
        {onBack ? (
          <Button type="button" variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
            <ArrowLeft aria-hidden="true" />
            홈으로
          </Button>
        ) : null}
        <div className="flex size-11 items-center justify-center rounded-2xl bg-brand/10 text-brand">
          {mode === "login" ? <LogIn aria-hidden="true" /> : <UserPlus aria-hidden="true" />}
        </div>
        <h1 id="auth-title" className="mt-5 text-2xl font-bold tracking-tight">
          {mode === "login" ? "Trego 로그인" : "Trego 회원가입"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {mode === "login"
            ? "DB 계정으로 로그인해 내 프로젝트와 실시간 협업을 확인합니다."
            : "이메일 계정을 만들면 바로 로그인됩니다."}
        </p>

        <div className="mt-6 grid grid-cols-2 rounded-xl bg-muted p-1">
          {(["login", "register"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                mode === value ? "bg-background shadow-sm" : "text-muted-foreground"
              }`}
              onClick={() => {
                setMode(value);
                setError(null);
              }}
            >
              {value === "login" ? "로그인" : "회원가입"}
            </button>
          ))}
        </div>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          {mode === "register" ? (
            <div>
              <label htmlFor="auth-name" className="text-sm font-medium">
                이름
              </label>
              <input
                id="auth-name"
                value={name}
                required
                maxLength={40}
                autoComplete="name"
                className="mt-1.5 h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/15"
                onChange={(event) => setName(event.target.value)}
              />
            </div>
          ) : null}
          <div>
            <label htmlFor="auth-email" className="text-sm font-medium">
              이메일
            </label>
            <input
              id="auth-email"
              type="email"
              value={email}
              required
              autoComplete="username"
              className="mt-1.5 h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/15"
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="auth-password" className="text-sm font-medium">
              비밀번호
            </label>
            <input
              id="auth-password"
              type="password"
              value={password}
              required
              minLength={mode === "register" ? 8 : undefined}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              className="mt-1.5 h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/15"
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm leading-5 text-destructive">
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-11 w-full bg-brand text-brand-foreground hover:bg-brand-hover"
          >
            {isSubmitting ? "처리 중…" : mode === "login" ? "로그인" : "계정 만들기"}
          </Button>
        </form>
      </section>
    </main>
  );
}
