// Explore 패널이 보여 주는 목업 장소 한 건의 표시용 필드 타입

export interface MockPlace {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly summary: string;
  readonly address: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly hours: string;
  readonly phone: string;
  readonly website: string;
  readonly rating: number;
  readonly reviewCount: number;
  readonly priceLevel: string;
  readonly tags: readonly string[];
}

// 장소를 넣을 수 있는 일정 위치다. places는 planner 트리를 모르므로 app이 이 형태로 번역해 준다.
export interface PlaceAddTarget {
  readonly id: string;
  readonly label: string;
  readonly color: string | null;
  readonly group: "day" | "wish";
}
