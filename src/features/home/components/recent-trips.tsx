import { ArrowUpRight, CalendarDays, MapPin } from "lucide-react";
import type { ReactNode } from "react";

import type { HomeTripSummary } from "../types";

type RecentTripsProps = {
  trips: readonly HomeTripSummary[];
  headerAction?: ReactNode;
  onTripSelect?: (trip: HomeTripSummary) => void;
};

const tripToneClassNames = [
  "from-brand/20 via-sky-100 to-cyan-50",
  "from-amber-100 via-orange-50 to-rose-100",
  "from-emerald-100 via-teal-50 to-sky-100",
  "from-violet-100 via-fuchsia-50 to-rose-100",
];

type TripCardContentProps = {
  trip: HomeTripSummary;
  toneClassName: string;
};

function TripCardContent({ trip, toneClassName }: TripCardContentProps) {
  return (
    <>
      <div
        aria-hidden="true"
        className={`relative h-32 overflow-hidden bg-linear-to-br ${toneClassName}`}
      >
        <div className="absolute -top-8 -right-6 size-28 rounded-full border border-white/70 bg-white/30" />
        <div className="absolute right-16 -bottom-10 size-24 rounded-full border border-white/60 bg-white/25" />
        <MapPin className="absolute bottom-4 left-4 size-6 text-foreground/65" />
      </div>
      <div className="p-4 text-left">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-1 font-semibold tracking-tight">{trip.title}</h3>
          <ArrowUpRight aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand" />
        </div>
        {trip.description ? (
          <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">
            {trip.description}
          </p>
        ) : null}
        {trip.dateLabel ? (
          <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <CalendarDays aria-hidden="true" className="size-3.5" />
            {trip.dateLabel}
          </p>
        ) : null}
      </div>
    </>
  );
}

export function RecentTrips({ trips, headerAction, onTripSelect }: RecentTripsProps) {
  return (
    <section aria-labelledby="recent-trips-title" className="w-full">
      <div className="mb-4 flex items-center justify-between gap-4 px-1">
        <div>
          <h2 id="recent-trips-title" className="text-xl font-semibold tracking-tight">
            최근 여행
          </h2>
          <p className="mt-1 hidden text-sm text-muted-foreground sm:block">
            계획하던 곳부터 이어가세요
          </p>
        </div>
        {headerAction}
      </div>

      {trips.length > 0 ? (
        <ul className="-mx-4 flex snap-x [scrollbar-width:none] gap-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 lg:grid-cols-3 xl:grid-cols-4 [&::-webkit-scrollbar]:hidden">
          {trips.map((trip, index) => {
            const cardClassName =
              "block w-[78vw] max-w-72 shrink-0 snap-start overflow-hidden rounded-3xl border bg-card shadow-sm transition sm:w-auto sm:max-w-none hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
            const content = (
              <TripCardContent
                trip={trip}
                toneClassName={tripToneClassNames[index % tripToneClassNames.length]}
              />
            );

            return (
              <li key={trip.id}>
                {onTripSelect ? (
                  <button
                    type="button"
                    className={cardClassName}
                    aria-label={`${trip.title} 여행 열기`}
                    onClick={() => onTripSelect(trip)}
                  >
                    {content}
                  </button>
                ) : (
                  <article className={cardClassName}>{content}</article>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-3xl border border-dashed bg-muted/35 px-6 py-12 text-center text-sm text-muted-foreground">
          아직 만든 여행이 없습니다.
        </p>
      )}
    </section>
  );
}
