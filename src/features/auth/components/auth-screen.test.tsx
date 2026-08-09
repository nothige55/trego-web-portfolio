import { describe, expect, it, vi } from "vitest";

import { AuthScreen } from "@/features/auth/components/auth-screen";
import { render, screen, userEvent } from "@/testing/test-utils";

describe("AuthScreen", () => {
  it("submits an email and password login", async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn().mockResolvedValue(undefined);
    render(<AuthScreen isSubmitting={false} onLogin={onLogin} onRegister={vi.fn()} />);

    await user.type(screen.getByLabelText("이메일"), "one@example.com");
    await user.type(screen.getByLabelText("비밀번호"), "password");
    await user.click(screen.getAllByRole("button", { name: "로그인" })[1]!);

    expect(onLogin).toHaveBeenCalledWith({
      email: "one@example.com",
      password: "password",
    });
  });

  it("switches to DB registration and submits the required fields", async () => {
    const user = userEvent.setup();
    const onRegister = vi.fn().mockResolvedValue(undefined);
    render(<AuthScreen isSubmitting={false} onLogin={vi.fn()} onRegister={onRegister} />);

    await user.click(screen.getByRole("button", { name: "회원가입" }));
    await user.type(screen.getByLabelText("이름"), " One ");
    await user.type(screen.getByLabelText("이메일"), "one@example.com");
    await user.type(screen.getByLabelText("비밀번호"), "password");
    await user.click(screen.getByRole("button", { name: "계정 만들기" }));

    expect(onRegister).toHaveBeenCalledWith({
      name: "One",
      email: "one@example.com",
      password: "password",
    });
  });
});
