export interface AuthUser {
  id: string;
  email: string;
  name: string;
  slackMemberId: string;
  companyCode: string;
  role: string;
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
  role: 'employee' | 'admin';
}

export interface SignInPayload {
  loginId: string;
  password: string;
}
