import { describe, expect, it } from "vitest";

import App from "@/app/app";
import { render, screen } from "@/testing/test-utils";

describe("App", () => {
  it("renders the root route", async () => {
    window.history.replaceState({}, "", "/");

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Trego" })).toBeInTheDocument();
  });
});
