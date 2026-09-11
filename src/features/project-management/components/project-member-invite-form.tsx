// 채팅 패널의 멤버 추가 영역에 들어가는 초대 폼
// 이메일·권한 입력과 요청 상태를 스스로 소유하고, 인증된 client만 app에서 주입받음

import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { addProjectMember } from "@/features/project-management/api/project-management-api";
import type { ProjectMemberRole } from "@/features/project-management/types";
import type { ApiClient } from "@/lib/api-client";

type ProjectMemberInviteFormProps = {
  readonly client: Pick<ApiClient, "post">;
  readonly projectId: string;
};

export function ProjectMemberInviteForm({ client, projectId }: ProjectMemberInviteFormProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ProjectMemberRole>("editor");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");

    try {
      await addProjectMember(projectId, email.trim(), role, client);
      setEmail("");
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  return (
    <form className="min-w-0 border-b bg-muted/25 p-3" onSubmit={handleSubmit}>
      <p className="text-xs font-semibold">프로젝트 멤버 추가</p>
      <div className="mt-2 grid min-w-0 gap-2">
        <label className="sr-only" htmlFor="project-member-email">
          멤버 이메일
        </label>
        <input
          id="project-member-email"
          type="email"
          required
          value={email}
          placeholder="member@example.com"
          className="h-9 w-full min-w-0 rounded-lg border bg-background px-2.5 text-xs outline-none focus-visible:border-brand"
          onChange={(event) => {
            setEmail(event.target.value);
            setStatus("idle");
          }}
        />
        <div className="flex min-w-0 gap-2">
          <label className="sr-only" htmlFor="project-member-role">
            멤버 권한
          </label>
          <select
            id="project-member-role"
            value={role}
            className="h-9 min-w-0 flex-1 rounded-lg border bg-background px-2 text-xs"
            onChange={(event) => setRole(event.target.value as ProjectMemberRole)}
          >
            <option value="editor">편집자</option>
            <option value="viewer">보기 전용</option>
          </select>
          <Button
            type="submit"
            size="sm"
            className="shrink-0"
            disabled={status === "submitting" || !email.trim()}
          >
            추가
          </Button>
        </div>
      </div>
      {status === "success" ? (
        <p role="status" className="mt-2 text-xs text-emerald-700">
          멤버를 추가했습니다. 상대 계정에서 목록을 새로고침하면 표시됩니다.
        </p>
      ) : null}
      {status === "error" ? (
        <p role="alert" className="mt-2 text-xs text-destructive">
          멤버를 추가하지 못했습니다. 가입된 이메일인지 확인해 주세요.
        </p>
      ) : null}
    </form>
  );
}
