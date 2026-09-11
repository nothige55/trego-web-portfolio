// 인증 도메인 타입. AuthSession은 app/auth와 실시간 화면이 현재 사용자 정보로 함께 씀

export type AuthenticatedMember = {
  readonly email: string;
  readonly id: string;
  readonly name: string;
  readonly profileUrl?: string | null;
};

export type AuthSession = AuthenticatedMember & {
  readonly accessToken: string;
};

export type LoginInput = {
  readonly email: string;
  readonly password: string;
};

export type RegisterInput = LoginInput & {
  readonly name: string;
};
