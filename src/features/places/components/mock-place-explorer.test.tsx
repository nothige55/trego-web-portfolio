import { describe, expect, it } from "vitest";

import { MockPlaceExplorer } from "@/features/places/components/mock-place-explorer";
import { render, screen, userEvent } from "@/testing/test-utils";

describe("MockPlaceExplorer", () => {
  it("filters mock places and opens a detailed place view without enabling schedule creation", async () => {
    const user = userEvent.setup();
    render(<MockPlaceExplorer />);

    await user.type(screen.getByRole("textbox", { name: "장소 검색" }), "숲");

    expect(screen.getByText("검색 결과 1개")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /비자림/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /성산일출봉/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /비자림/ }));

    expect(screen.getByRole("heading", { name: "비자림" })).toBeInTheDocument();
    expect(screen.getByText("제주특별자치도 제주시 구좌읍 비자숲길 55")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "일정에 추가" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "검색 결과" }));
    expect(screen.getByRole("textbox", { name: "장소 검색" })).toHaveValue("숲");
  });
});
