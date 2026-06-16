import { api } from '../../api/questApi';
import type {
  AuthResponse,
  SignInPayload,
  SignUpPayload,
  UpdateProfilePayload,
} from '../types/auth';

export const authApi = {
  signup: async (payload: SignUpPayload): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>('/auth/signup', payload);
    return data;
  },

  login: async (payload: SignInPayload): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>('/auth/login', payload);
    return data;
  },

  me: async () => {
    const { data } = await api.get<AuthResponse['user']>('/auth/me');
    return data;
  },

  updateProfile: async (payload: UpdateProfilePayload): Promise<AuthResponse['user']> => {
    const { data } = await api.patch<AuthResponse['user']>('/auth/me', payload);
    return data;
  },

  logout: async (accessToken: string): Promise<void> => {
    // 서버에서 tokenVersion 을 올려 토큰을 폐기하고 refresh 쿠키를 제거한다.
    // 로컬 토큰이 이미 지워진 뒤 호출되므로 Authorization 을 명시적으로 싣는다.
    await api.post('/auth/logout', undefined, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },
};
