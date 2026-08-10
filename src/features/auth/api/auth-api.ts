import type { AuthenticatedMember, LoginInput, RegisterInput } from "@/features/auth/types";
import type { ApiClient } from "@/lib/api-client";
import { apiClient } from "@/lib/api-client";

type LoginResponse = {
  readonly accessToken: string;
};

type CurrentMemberResponse = {
  readonly email: string;
  readonly name: string;
  readonly profileUrl?: string | null;
  readonly publicId: string;
};

export async function loginWithPassword(
  input: LoginInput,
  client: Pick<ApiClient, "post"> = apiClient,
): Promise<string> {
  const response = await client.post<LoginResponse, LoginInput>("/api/auth/login", input);
  return response.accessToken;
}

export async function registerWithPassword(
  input: RegisterInput,
  client: Pick<ApiClient, "post"> = apiClient,
): Promise<void> {
  const formData = new FormData();
  formData.set("name", input.name);
  formData.set("email", input.email);
  formData.set("password", input.password);
  await client.post<unknown, FormData>("/api/auth/register", formData);
}

export async function getCurrentMember(
  client: Pick<ApiClient, "get">,
): Promise<AuthenticatedMember> {
  const response = await client.get<CurrentMemberResponse>("/api/me/info");

  return {
    email: response.email,
    id: response.publicId,
    name: response.name,
    profileUrl: response.profileUrl,
  };
}
