import { api } from '../../api/questApi';
import type { AuthResponse, SignInPayload, SignUpPayload } from '../types/auth';

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
};
