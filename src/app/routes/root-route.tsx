import { HomeScreen } from "@/features/home/components/home-screen";
import type { HomeTripSummary } from "@/features/home/types";

const recentTrips: HomeTripSummary[] = [
  {
    id: "jeju-late-summer",
    title: "제주 늦여름 여행",
    description: "오름과 바다를 따라 여유롭게 보내는 4일",
    dateLabel: "2026. 9. 3. - 9. 6.",
  },
  {
    id: "kyoto-autumn",
    title: "교토 단풍 산책",
    description: "부모님과 오래된 골목을 천천히 걷는 여행",
    dateLabel: "2026. 11. 12. - 11. 15.",
  },
  {
    id: "busan-food",
    title: "부산 미식 주말",
    description: "시장부터 바닷가까지 이어지는 맛집 동선",
    dateLabel: "2026. 8. 22. - 8. 23.",
  },
];

const deferToRouteIntegration = () => undefined;

export function RootRoute() {
  return (
    <HomeScreen
      recentTrips={recentTrips}
      onPromptSubmit={deferToRouteIntegration}
      onCreateTrip={deferToRouteIntegration}
    />
  );
}
