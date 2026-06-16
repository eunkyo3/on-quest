import { create } from 'zustand';
import { getApiErrorMessage } from '../../api/httpError';
import { persistAuthTokens } from '../../api/questApi';
import { authApi } from '../api/authApi';
import type { AuthUser, SignInPayload, SignUpPayload, UpdateProfilePayload } from '../types/auth';

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
  updateProfile: (payload: UpdateProfilePayload) => Promise<void>;
  patchUser: (partial: Partial<AuthUser>) => void;
  touchActivity: () => void;
}

const persist = (accessToken: string, user: AuthUser) => {
  // refresh token 은 HttpOnly 쿠키로만 보관되고 JS 에서 접근하지 않는다.
  persistAuthTokens(accessToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

const clearPersist = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

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
    // 로컬을 비우기 전에 토큰을 캡처해 로그아웃 요청에 실어 보낸다(서버 tokenVersion 증가).
    const token = get().accessToken ?? localStorage.getItem(TOKEN_KEY);
    clearPersist();
    set({ user: null, accessToken: null });
    // 서버 세션 폐기는 best-effort — 실패해도 로컬은 이미 정리됨.
    if (token) void authApi.logout(token).catch(() => undefined);
  },

  updateProfile: async (payload) => {
    try {
      const user = await authApi.updateProfile(payload);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
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
