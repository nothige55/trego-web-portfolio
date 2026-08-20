import {
  ArrowLeft,
  Clock3,
  ExternalLink,
  Globe2,
  MapPin,
  Phone,
  Plus,
  Search,
  Star,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { MOCK_PLACES } from "@/features/places/data/mock-places";
import type { MockPlace } from "@/features/places/types/mock-place";

function PlaceDetail({
  place,
  onBack,
}: {
  readonly place: MockPlace;
  readonly onBack: () => void;
}) {
  return (
    <article className="scrollbar-hide h-full overflow-y-auto">
      <button
        type="button"
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        onClick={onBack}
      >
        <ArrowLeft aria-hidden="true" className="size-3.5" />
        검색 결과
      </button>
      <div className="mt-4 rounded-2xl bg-linear-to-br from-brand/15 via-sky-100 to-cyan-50 p-5">
        <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-brand">
          목업 장소 · {place.category}
        </span>
        <h2 className="mt-4 text-xl font-bold tracking-tight">{place.name}</h2>
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium">
          <Star aria-hidden="true" className="size-3.5 fill-amber-400 text-amber-400" />
          {place.rating.toFixed(1)}
          <span className="text-muted-foreground">
            리뷰 {place.reviewCount.toLocaleString("ko-KR")}개
          </span>
        </p>
      </div>

      <p className="mt-5 text-sm leading-6 text-muted-foreground">{place.summary}</p>
      <dl className="mt-5 space-y-3 text-sm">
        <div className="flex gap-3">
          <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand" />
          <div>
            <dt className="sr-only">주소</dt>
            <dd className="leading-5">{place.address}</dd>
          </div>
        </div>
        <div className="flex gap-3">
          <Clock3 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand" />
          <div>
            <dt className="sr-only">운영 시간</dt>
            <dd>{place.hours}</dd>
          </div>
        </div>
        <div className="flex gap-3">
          <Phone aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand" />
          <div>
            <dt className="sr-only">전화번호</dt>
            <dd>{place.phone}</dd>
          </div>
        </div>
        <div className="flex gap-3">
          <Globe2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand" />
          <div className="min-w-0">
            <dt className="sr-only">웹사이트</dt>
            <dd>
              <a
                className="inline-flex max-w-full items-center gap-1 text-brand hover:underline"
                href={place.website}
                target="_blank"
                rel="noreferrer"
              >
                <span className="truncate">공식 관광 정보</span>
                <ExternalLink aria-hidden="true" className="size-3" />
              </a>
            </dd>
          </div>
        </div>
      </dl>

      <div className="mt-5 flex flex-wrap gap-2">
        {place.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
          >
            {tag}
          </span>
        ))}
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
          {place.priceLevel}
        </span>
      </div>

      <Button
        type="button"
        className="mt-6 w-full"
        disabled
        title="Google Places 연결 후 제공됩니다"
      >
        <Plus aria-hidden="true" />
        일정에 추가
      </Button>
      <p className="mt-2 text-center text-[11px] leading-4 text-muted-foreground">
        실제 장소 확인과 일정 추가는 Google Places 연결 후 활성화됩니다.
      </p>
    </article>
  );
}

export function MockPlaceExplorer() {
  const [query, setQuery] = useState("");
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const selectedPlace = MOCK_PLACES.find((place) => place.id === selectedPlaceId);
  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
  const filteredPlaces = useMemo(
    () =>
      normalizedQuery
        ? MOCK_PLACES.filter((place) =>
            [place.name, place.category, place.address, ...place.tags]
              .join(" ")
              .toLocaleLowerCase("ko-KR")
              .includes(normalizedQuery),
          )
        : MOCK_PLACES,
    [normalizedQuery],
  );

  if (selectedPlace) {
    return <PlaceDetail place={selectedPlace} onBack={() => setSelectedPlaceId(null)} />;
  }

  return (
    <section aria-label="목업 장소 탐색" className="flex min-h-0 w-full flex-col">
      <label htmlFor="mock-place-search" className="sr-only">
        장소 검색
      </label>
      <div className="flex h-10 items-center gap-2 rounded-xl border bg-background px-3 focus-within:border-brand focus-within:ring-3 focus-within:ring-brand/10">
        <Search aria-hidden="true" className="size-4 text-muted-foreground" />
        <input
          id="mock-place-search"
          value={query}
          placeholder="장소, 지역, 카테고리 검색"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <p>{normalizedQuery ? `검색 결과 ${filteredPlaces.length}개` : "제주 추천 장소"}</p>
        <span className="rounded-full bg-brand/10 px-2 py-1 font-medium text-brand">
          목업 데이터
        </span>
      </div>

      <div className="mt-3 scrollbar-hide min-h-0 flex-1 space-y-2 overflow-y-auto">
        {filteredPlaces.length > 0 ? (
          filteredPlaces.map((place) => (
            <button
              key={place.id}
              type="button"
              className="group w-full rounded-xl border bg-background p-3 text-left transition hover:border-brand/40 hover:bg-brand/5 focus-visible:outline-2 focus-visible:outline-brand"
              onClick={() => setSelectedPlaceId(place.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{place.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{place.category}</p>
                </div>
                <span className="flex shrink-0 items-center gap-1 text-xs font-medium">
                  <Star aria-hidden="true" className="size-3 fill-amber-400 text-amber-400" />
                  {place.rating.toFixed(1)}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                {place.summary}
              </p>
            </button>
          ))
        ) : (
          <div className="rounded-xl border border-dashed px-4 py-10 text-center">
            <p className="text-sm font-medium">일치하는 목업 장소가 없습니다</p>
            <p className="mt-1 text-xs text-muted-foreground">성산, 숲, 카페처럼 검색해 보세요.</p>
          </div>
        )}
      </div>
    </section>
  );
}
