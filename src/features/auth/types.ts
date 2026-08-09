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
