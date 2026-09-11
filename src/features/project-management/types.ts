// 프로젝트 목록·생성·멤버 권한의 서버 계약 타입
// 홈 화면용 요약으로 바꾸는 일은 app/routes/root-route가 맡음

export type ProjectSummary = {
  readonly createdAt: string;
  readonly endDate: string;
  readonly isPublic: boolean;
  readonly publicId: string;
  readonly startDate: string;
  readonly thumbnailUrl?: string | null;
  readonly title: string;
  readonly updatedAt: string;
};

export type CreateProjectInput = {
  readonly endDate: string;
  readonly rootPathId: string;
  readonly startDate: string;
  readonly title: string;
};

export type ProjectMemberRole = "editor" | "viewer";
