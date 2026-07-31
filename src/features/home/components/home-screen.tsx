import { ArrowUp } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import type { CreateTripInput, HomeTripSummary } from "../types";
import { ManualTripDialog } from "./manual-trip-dialog";
import { RecentTrips } from "./recent-trips";

type HomeScreenProps = {
  recentTrips: readonly HomeTripSummary[];
  onPromptSubmit: (prompt: string) => void;
  onCreateTrip: (trip: CreateTripInput) => void;
  onTripSelect?: (trip: HomeTripSummary) => void;
};

export function HomeScreen({
  recentTrips,
  onPromptSubmit,
  onCreateTrip,
  onTripSelect,
}: HomeScreenProps) {
  const [prompt, setPrompt] = useState("");
  const trimmedPrompt = prompt.trim();

  const handlePromptSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!trimmedPrompt) {
      return;
    }

    onPromptSubmit(trimmedPrompt);
    setPrompt("");
  };

  return (
    <main className="relative min-h-svh overflow-hidden bg-background px-4 py-10 sm:px-8 sm:py-14 lg:py-18">
      <div
        aria-hidden="true"
        className="absolute top-0 left-1/2 z-0 h-80 w-[42rem] max-w-[120vw] -translate-x-1/2 rounded-full bg-brand/10 blur-3xl"
      />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center">
        <section className="flex w-full max-w-3xl flex-col items-center pt-[8svh] text-center sm:pt-[10svh]">
          <h1 className="max-w-2xl text-3xl font-bold tracking-[-0.035em] text-balance sm:text-5xl">
            어떤 여행을 계획하고 있나요?
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
            떠나고 싶은 곳과 일정을 한 문장으로 알려주세요.
          </p>

          <form className="mt-8 w-full" onSubmit={handlePromptSubmit}>
            <label htmlFor="trip-planning-prompt" className="sr-only">
              여행 계획 입력
            </label>
            <div className="flex min-h-14 items-center gap-2 rounded-3xl border border-border bg-card p-2 pl-5 shadow-[0_14px_48px_-28px_rgba(13,153,255,0.5)] transition focus-within:border-brand/55 focus-within:ring-4 focus-within:ring-brand/10">
              <textarea
                id="trip-planning-prompt"
                rows={1}
                value={prompt}
                placeholder="예: 가을에 부모님과 떠날 3박 4일 교토 여행"
                className="max-h-36 min-h-10 flex-1 resize-none bg-transparent py-2 text-sm leading-6 outline-none placeholder:text-muted-foreground sm:text-base"
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              <Button
                type="submit"
                size="icon"
                aria-label="여행 계획 시작"
                disabled={!trimmedPrompt}
                className="size-9 rounded-full bg-brand text-brand-foreground hover:bg-brand-hover"
              >
                <ArrowUp aria-hidden="true" className="size-4" />
              </Button>
            </div>
          </form>
        </section>

        <div className="mt-14 w-full sm:mt-18">
          <RecentTrips
            trips={recentTrips}
            headerAction={<ManualTripDialog onCreateTrip={onCreateTrip} />}
            onTripSelect={onTripSelect}
          />
        </div>
      </div>
    </main>
  );
}
