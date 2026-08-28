import { useState } from "react";
import { describe, expect, it } from "vitest";

import { ProjectChatTabs } from "@/app/realtime/project-chat-tabs";
import { render, screen, userEvent } from "@/testing/test-utils";

describe("ProjectChatTabs", () => {
  it("keeps the existing team chat as the default and switches to the private AI panel", async () => {
    const user = userEvent.setup();
    render(
      <ProjectChatTabs aiContent={<div>AI content</div>} teamContent={<div>Team content</div>} />,
    );

    expect(screen.getByRole("tab", { name: "팀 채팅" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Team content")).toBeVisible();
    expect(screen.getByText("AI content")).not.toBeVisible();

    await user.click(screen.getByRole("tab", { name: "AI 플래너" }));

    expect(screen.getByRole("tab", { name: "AI 플래너" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("AI content")).toBeVisible();
    expect(screen.getByText("Team content")).not.toBeVisible();
  });

  it("keeps each chat mounted so drafts survive tab switches", async () => {
    const user = userEvent.setup();

    function Draft() {
      const [value, setValue] = useState("");
      return (
        <input
          aria-label="AI draft"
          value={value}
          onChange={(event) => setValue(event.currentTarget.value)}
        />
      );
    }

    render(<ProjectChatTabs aiContent={<Draft />} teamContent={<div>Team content</div>} />);

    await user.click(screen.getByRole("tab", { name: "AI 플래너" }));
    await user.type(screen.getByRole("textbox", { name: "AI draft" }), "draft message");
    await user.click(screen.getByRole("tab", { name: "팀 채팅" }));
    await user.click(screen.getByRole("tab", { name: "AI 플래너" }));

    expect(screen.getByRole("textbox", { name: "AI draft" })).toHaveValue("draft message");
  });
});
