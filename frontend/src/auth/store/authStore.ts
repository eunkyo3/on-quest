import { create } from 'zustand';
import { getApiErrorMessage } from '../../api/httpError';
import { authApi } from '../api/authApi';
import type { AuthUser, SignInPayload, SignUpPayload } from '../types/auth';

const TOKEN_KEY = 'onquest_access_token';
const USER_KEY = 'onquest_user';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isHydrated: boolean;
  lastActivityAt: number;

  hydrate: () => void;
  login: (payload: SignInPayload) => Promise<void>;
  signup: (payload: SignUpPayload) => Promise<void>;
  logout: () => void;
  touchActivity: () => void;
}

const persist = (token: string, user: AuthUser) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

const clearPersist = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export const getStoredToken = (): string | null => localStorage.getItem(TOKEN_KEY);

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  isHydrated: false,
  lastActivityAt: Date.now(),

  hydrate: () => {
    const token = localStorage.getItem(TOKEN_KEY);
    const rawUser = localStorage.getItem(USER_KEY);

    if (!token || !rawUser) {
      set({ isHydrated: true });
      return;
    }

    try {
      const user = JSON.parse(rawUser) as AuthUser;
      set({ user, accessToken: token, isHydrated: true, lastActivityAt: Date.now() });
    } catch {
      clearPersist();
      set({ user: null, accessToken: null, isHydrated: true });
    }
  },

  login: async (payload) => {
    try {
      const result = await authApi.login(payload);
      persist(result.accessToken, result.user);
      set({ user: result.user, accessToken: result.accessToken, lastActivityAt: Date.now() });
    } catch (e) {
      throw new Error(getApiErrorMessage(e, '로그인에 실패했습니다.'));
    }
  },

  signup: async (payload) => {
    try {
      const result = await authApi.signup(payload);
      persist(result.accessToken, result.user);
      set({ user: result.user, accessToken: result.accessToken, lastActivityAt: Date.now() });
    } catch (e) {
      throw new Error(getApiErrorMessage(e, '회원가입에 실패했습니다.'));
    }
  },

  logout: () => {
    clearPersist();
    set({ user: null, accessToken: null });
  },

  touchActivity: () => {
    if (!get().accessToken) return;
    set({ lastActivityAt: Date.now() });
  },
}));
