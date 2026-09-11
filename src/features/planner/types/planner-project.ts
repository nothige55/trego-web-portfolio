// 일정 트리 밖의 프로젝트 메타데이터(제목, 여행 기간, 공개 여부) 타입. REST 상세 응답에서 이 필드만 추려 씀

export interface PlannerProjectDetails {
  readonly publicId: string;
  readonly title: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly isPublic: boolean;
}
