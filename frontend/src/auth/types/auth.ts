export type AppRole = 'superadmin' | 'admin' | 'employee';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  slackMemberId: string;
  companyCode: string;
  role: AppRole | string;
}

export interface AuthResponse {
  accessToken: string;
  /** refresh token 은 HttpOnly 쿠키로 전달되므로 응답 본문에는 없다. */
  user: AuthUser;
}

export interface SignUpPayload {
  email: string;
  name: string;
  password: string;
  slackMemberId: string;
  companyCode: string;
}

export interface SignInPayload {
  loginId: string;
  password: string;
}

export interface UpdateProfilePayload {
  name?: string;
  slackMemberId?: string;
  newPassword?: string;
  currentPassword?: string;
}
