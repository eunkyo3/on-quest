import { create } from 'zustand';
import { getApiErrorMessage } from '../../api/httpError';
import { persistAuthTokens } from '../../api/questApi';
import { authApi } from '../api/authApi';
import type { AuthUser, SignInPayload, SignUpPayload, UpdateProfilePayload } from '../types/auth';

const TOKEN_KEY = 'onquest_access_token';
const REFRESH_KEY = 'onquest_refresh_token';
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
  updateProfile: (payload: UpdateProfilePayload) => Promise<void>;
  patchUser: (partial: Partial<AuthUser>) => void;
  touchActivity: () => void;
}

const persist = (accessToken: string, refreshToken: string, user: AuthUser) => {
  persistAuthTokens(accessToken, refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

const clearPersist = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
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
      persist(result.accessToken, result.refreshToken, result.user);
      set({ user: result.user, accessToken: result.accessToken, lastActivityAt: Date.now() });
    } catch (e) {
      throw new Error(getApiErrorMessage(e, '로그인에 실패했습니다.'));
    }
  },

  signup: async (payload) => {
    try {
      const result = await authApi.signup(payload);
      persist(result.accessToken, result.refreshToken, result.user);
      set({ user: result.user, accessToken: result.accessToken, lastActivityAt: Date.now() });
    } catch (e) {
      throw new Error(getApiErrorMessage(e, '회원가입에 실패했습니다.'));
    }
  },

  logout: () => {
    clearPersist();
    set({ user: null, accessToken: null });
  },

  updateProfile: async (payload) => {
    try {
      const user = await authApi.updateProfile(payload);
      const token = localStorage.getItem(TOKEN_KEY);
      const refresh = localStorage.getItem(REFRESH_KEY);
      if (token && refresh) {
        persist(token, refresh, user);
      } else {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      }
      set({ user });
    } catch (e) {
      throw new Error(getApiErrorMessage(e, '프로필 저장에 실패했습니다.'));
    }
  },

  patchUser: (partial) => {
    const current = get().user;
    if (!current) return;
    const next = { ...current, ...partial };
    localStorage.setItem(USER_KEY, JSON.stringify(next));
    set({ user: next });
  },

  touchActivity: () => {
    if (!get().accessToken) return;
    set({ lastActivityAt: Date.now() });
  },
}));
