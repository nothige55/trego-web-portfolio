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
