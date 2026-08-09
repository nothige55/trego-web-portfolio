import { describe, expect, it, vi } from "vitest";

import App from "@/app/app";
import { router } from "@/app/router";
import { render, screen, userEvent } from "@/testing/test-utils";

vi.mock("@/features/planner/components/planner-map", () => ({
  PlannerMap: () => <section aria-label="지도 영역" />,
}));

describe("App", () => {
  it("renders the root route", async () => {
    const user = userEvent.setup();
    await router.navigate("/");

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "어떤 여행을 계획하고 있나요?" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "로그인" }));
    expect(await screen.findByRole("heading", { name: "Trego 로그인" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "홈으로" }));
    expect(
      await screen.findByRole("heading", { name: "어떤 여행을 계획하고 있나요?" }),
    ).toBeInTheDocument();
  });

  it("renders the planner route with its legacy-compatible URL", async () => {
    await router.navigate("/planner/demo/jeju-trip");

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Trego 로그인" })).toBeInTheDocument();
  });

  it("keeps the catch-all not-found route", async () => {
    await router.navigate("/missing-page");

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "페이지를 찾을 수 없습니다." }),
    ).toBeInTheDocument();
  });
});
