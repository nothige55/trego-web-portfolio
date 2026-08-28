export type MemberVerification =
  | { readonly status: "authenticated"; readonly memberId: string }
  | { readonly status: "unauthorized" };

type VerifyMemberOptions = {
  readonly apiBaseUrl: string;
  readonly authorization: string;
  readonly fetchImplementation?: typeof fetch;
  readonly signal?: AbortSignal;
};

// Gateway는 토큰을 스스로 해독하지 않고 ASP.NET에 물어본다.
// 서명 키를 복제하지 않아도 되고, 토큰 형식이 바뀌어도 여기를 고칠 일이 없다.
export async function verifyMember({
  apiBaseUrl,
  authorization,
  fetchImplementation = fetch,
  signal,
}: VerifyMemberOptions): Promise<MemberVerification> {
  const response = await fetchImplementation(`${apiBaseUrl.replace(/\/+$/, "")}/api/me/info`, {
    headers: { Accept: "application/json", Authorization: authorization },
    signal,
  });

  if (response.status === 401 || response.status === 403) {
    return { status: "unauthorized" };
  }
  if (!response.ok) {
    throw new Error(`Member verification failed with status ${response.status}.`);
  }

  const member: unknown = await response.json();
  const memberId =
    typeof member === "object" && member !== null && "publicId" in member
      ? (member as { publicId?: unknown }).publicId
      : undefined;

  if (typeof memberId !== "string" || memberId.trim() === "") {
    throw new Error("Member verification response did not include a public ID.");
  }

  return { status: "authenticated", memberId };
}
