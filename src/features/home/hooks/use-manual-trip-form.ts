// 새 여행 다이얼로그의 입력 상태와 검증을 소유
// 시작일을 종료일보다 뒤로 옮기면 이미 고른 종료일은 무효가 되므로 여기에서 함께 비움

import { useId, useState } from "react";

import type { CreateTripInput } from "../types";

function toDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export type ManualTripForm = {
  readonly endDate?: Date;
  readonly errorMessage: string;
  readonly errorMessageId: string;
  readonly isEndDateOpen: boolean;
  readonly isStartDateOpen: boolean;
  readonly startDate?: Date;
  readonly titleInputId: string;
  readonly title: string;
  readonly changeTitle: (title: string) => void;
  readonly reset: () => void;
  readonly selectEndDate: (date: Date) => void;
  readonly selectStartDate: (date: Date) => void;
  readonly setEndDateOpen: (isOpen: boolean) => void;
  readonly setStartDateOpen: (isOpen: boolean) => void;
  readonly submit: () => CreateTripInput | null;
};

export function useManualTripForm(): ManualTripForm {
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [isStartDateOpen, setStartDateOpen] = useState(false);
  const [isEndDateOpen, setEndDateOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const errorMessageId = useId();
  const titleInputId = useId();

  const reset = (): void => {
    setTitle("");
    setStartDate(undefined);
    setEndDate(undefined);
    setStartDateOpen(false);
    setEndDateOpen(false);
    setErrorMessage("");
  };

  const changeTitle = (nextTitle: string): void => {
    setTitle(nextTitle);
    setErrorMessage("");
  };

  const selectStartDate = (date: Date): void => {
    setStartDate(date);
    if (endDate && date.getTime() > endDate.getTime()) {
      setEndDate(undefined);
    }
    setErrorMessage("");
    setStartDateOpen(false);
  };

  const selectEndDate = (date: Date): void => {
    setEndDate(date);
    setErrorMessage("");
    setEndDateOpen(false);
  };

  const submit = (): CreateTripInput | null => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !startDate || !endDate) {
      setErrorMessage("제목과 여행 날짜를 모두 입력해 주세요.");
      return null;
    }

    if (startDate.getTime() > endDate.getTime()) {
      setErrorMessage("종료일은 시작일보다 빠를 수 없습니다.");
      return null;
    }

    return {
      title: trimmedTitle,
      startDate: toDateValue(startDate),
      endDate: toDateValue(endDate),
    };
  };

  return {
    changeTitle,
    endDate,
    errorMessage,
    errorMessageId,
    isEndDateOpen,
    isStartDateOpen,
    reset,
    selectEndDate,
    selectStartDate,
    setEndDateOpen,
    setStartDateOpen,
    startDate,
    submit,
    title,
    titleInputId,
  };
}
