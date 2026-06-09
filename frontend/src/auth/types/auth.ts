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
  refreshToken: string;
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
