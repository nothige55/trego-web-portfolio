import { Link } from "react-router";

export function NotFoundRoute() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-6 text-foreground">
      <section className="text-center">
        <p className="text-sm font-semibold text-brand">404</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">페이지를 찾을 수 없습니다.</h1>
        <Link
          className="mt-6 inline-flex rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          to="/"
        >
          홈으로 돌아가기
        </Link>
      </section>
    </main>
  );
}
