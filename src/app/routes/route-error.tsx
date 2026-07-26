import { isRouteErrorResponse, Link, useRouteError } from "react-router";

export function RouteError() {
  const error = useRouteError();

  let description = "요청을 처리하는 중 문제가 발생했습니다.";

  if (isRouteErrorResponse(error)) {
    description = `${error.status} ${error.statusText}`;
  } else if (import.meta.env.DEV && error instanceof Error) {
    description = error.message;
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-6 text-foreground">
      <section className="text-center">
        <p className="text-sm font-semibold text-destructive">오류</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">문제가 발생했습니다.</h1>
        <p className="mt-4 text-sm text-muted-foreground">{description}</p>
        <Link
          className="mt-6 inline-flex rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          to="/"
        >
          홈으로 돌아가기
        </Link>
      </section>
    </main>
  );
}
