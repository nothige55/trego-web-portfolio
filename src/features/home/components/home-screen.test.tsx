import { describe, expect, it, vi } from "vitest";

import { render, screen, userEvent } from "@/testing/test-utils";

import type { HomeTripSummary } from "../types";
import { HomeScreen } from "./home-screen";

const recentTrips: HomeTripSummary[] = [
  {
    id: "trip-jeju",
    title: "제주 늦여름 여행",
    description: "오름과 바다를 따라가는 4일",
    dateLabel: "2026. 9. 3. - 9. 6.",
  },
  {
    id: "trip-kyoto",
    title: "교토 단풍 산책",
    description: "부모님과 천천히 걷는 오래된 골목",
    dateLabel: "2026. 11. 12. - 11. 15.",
  },
];

const koreanWeekdays = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

function getKoreanDateLabel(date: Date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${koreanWeekdays[date.getDay()]}`;
}

function getDateValue(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

function renderHome(overrides?: Partial<React.ComponentProps<typeof HomeScreen>>) {
  const props: React.ComponentProps<typeof HomeScreen> = {
    recentTrips,
    onPromptSubmit: vi.fn(),
    onCreateTrip: vi.fn(),
    ...overrides,
  };

  render(<HomeScreen {...props} />);
  return props;
}

describe("HomeScreen", () => {
  it("submits a trimmed prompt with Enter and the submit button", async () => {
    const user = userEvent.setup();
    const onPromptSubmit = vi.fn();
    renderHome({ onPromptSubmit });
    const promptInput = screen.getByRole("textbox", { name: "여행 계획 입력" });

    await user.type(promptInput, "  가을 교토 3박 4일  {Enter}");

    expect(onPromptSubmit).toHaveBeenCalledWith("가을 교토 3박 4일");
    expect(promptInput).toHaveValue("");

    await user.type(promptInput, "부산 미식 여행");
    await user.click(screen.getByRole("button", { name: "여행 계획 시작" }));

    expect(onPromptSubmit).toHaveBeenLastCalledWith("부산 미식 여행");
    expect(onPromptSubmit).toHaveBeenCalledTimes(2);
  });

  it("prevents an empty prompt from being submitted", async () => {
    const user = userEvent.setup();
    const onPromptSubmit = vi.fn();
    renderHome({ onPromptSubmit });
    const promptInput = screen.getByRole("textbox", { name: "여행 계획 입력" });
    const submitButton = screen.getByRole("button", { name: "여행 계획 시작" });

    expect(submitButton).toBeDisabled();
    await user.type(promptInput, "   {Enter}");

    expect(onPromptSubmit).not.toHaveBeenCalled();
    expect(submitButton).toBeDisabled();
  });

  it("creates a manual trip and closes the dialog", async () => {
    const user = userEvent.setup();
    const onCreateTrip = vi.fn();
    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth(), 10);
    const endDate = new Date(today.getFullYear(), today.getMonth(), 12);
    renderHome({ onCreateTrip });

    await user.click(screen.getByRole("button", { name: "직접 여행 만들기" }));

    expect(screen.getByRole("dialog", { name: "새 여행 만들기" })).toBeInTheDocument();
    expect(screen.getByLabelText("여행 제목")).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "여행 만들기" }));
    expect(screen.getByRole("alert")).toHaveTextContent("제목과 여행 날짜를 모두 입력해 주세요.");
    await user.type(screen.getByLabelText("여행 제목"), "  제주 가족 여행  ");
    await user.click(screen.getByRole("button", { name: "시작일 선택" }));
    expect(await screen.findByRole("button", { name: "이전 달" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다음 달" })).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: getKoreanDateLabel(startDate) }));
    await user.click(screen.getByRole("button", { name: "종료일 선택" }));
    await user.click(await screen.findByRole("button", { name: getKoreanDateLabel(endDate) }));
    await user.click(screen.getByRole("button", { name: "여행 만들기" }));

    expect(onCreateTrip).toHaveBeenCalledWith({
      title: "제주 가족 여행",
      startDate: getDateValue(startDate),
      endDate: getDateValue(endDate),
    });
    expect(screen.queryByRole("dialog", { name: "새 여행 만들기" })).not.toBeInTheDocument();
  });

  it("cancels manual creation without submitting and selects a recent trip", async () => {
    const user = userEvent.setup();
    const onCreateTrip = vi.fn();
    const onTripSelect = vi.fn();
    renderHome({ onCreateTrip, onTripSelect });

    expect(screen.getByRole("heading", { name: "최근 여행" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "직접 여행 만들기" }));
    await user.type(screen.getByLabelText("여행 제목"), "취소할 여행");
    await user.click(screen.getByRole("button", { name: "취소" }));

    expect(onCreateTrip).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "새 여행 만들기" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "직접 여행 만들기" })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "제주 늦여름 여행 여행 열기" }));
    expect(onTripSelect).toHaveBeenCalledWith(recentTrips[0]);
  });
});
