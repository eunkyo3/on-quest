import axios from 'axios';
import type {
  AssignableEmployee,
  AssigneeQuestStats,
  CreateQuestPayload,
  PaginatedQuests,
  Quest,
  QuestListParams,
  QuestStats,
  ReviewQuestPayload,
  UpdateQuestPayload,
} from '../types/quest';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? '';
const TOKEN_KEY = 'onquest_access_token';
const REFRESH_KEY = 'onquest_refresh_token';

export const api = axios.create({
  baseURL: `${baseURL}/api`,
  timeout: 10_000,
});

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refresh = localStorage.getItem(REFRESH_KEY);
  if (!refresh) throw new Error('no refresh');
  const { data } = await axios.post<{ accessToken: string; refreshToken: string }>(
    `${baseURL}/api/auth/refresh`,
    { refreshToken: refresh },
  );
  localStorage.setItem(TOKEN_KEY, data.accessToken);
  localStorage.setItem(REFRESH_KEY, data.refreshToken);
  return data.accessToken;
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    const original = error.config;
    if (!original || original.url?.includes('/auth/refresh')) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
      localStorage.removeItem('onquest_user');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    try {
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }
      const token = await refreshPromise;
      original.headers.Authorization = `Bearer ${token}`;
      return api.request(original);
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
      localStorage.removeItem('onquest_user');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }
  },
);

export function persistAuthTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export const questApi = {
  list: async (params?: QuestListParams): Promise<PaginatedQuests> => {
    const { data } = await api.get<PaginatedQuests>('/quests', { params });
    return data;
  },

  getOne: async (id: string): Promise<Quest> => {
    const { data } = await api.get<Quest>(`/quests/${id}`);
    return data;
  },

  stats: async (): Promise<QuestStats> => {
    const { data } = await api.get<QuestStats>('/quests/stats');
    return data;
  },

  statsByAssignee: async (): Promise<AssigneeQuestStats[]> => {
    const { data } = await api.get<AssigneeQuestStats[]>('/quests/stats/by-assignee');
    return data;
  },

  assignableEmployees: async (): Promise<AssignableEmployee[]> => {
    const { data } = await api.get<AssignableEmployee[]>('/quests/assignable-employees');
    return data;
  },

  create: async (payload: CreateQuestPayload): Promise<Quest> => {
    const { data } = await api.post<Quest>('/quests', payload);
    return data;
  },

  update: async (id: string, payload: UpdateQuestPayload): Promise<Quest> => {
    const { data } = await api.patch<Quest>(`/quests/${id}`, payload);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/quests/${id}`);
  },

  start: async (id: string): Promise<Quest> => {
    const { data } = await api.post<Quest>(`/quests/${id}/start`);
    return data;
  },

  uploadProof: async (id: string, file: File, submissionNote?: string): Promise<Quest> => {
    const form = new FormData();
    form.append('file', file);
    form.append('submissionNote', submissionNote?.trim() ?? '');
    const { data } = await api.post<Quest>(`/quests/${id}/proof`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  review: async (id: string, payload: ReviewQuestPayload): Promise<Quest> => {
    const { data } = await api.patch<Quest>(`/quests/${id}/review`, payload);
    return data;
  },

  downloadProof: async (id: string, fileName: string | null): Promise<void> => {
    const response = await api.get<Blob>(`/quests/${id}/proof`, { responseType: 'blob' });
    const blobUrl = window.URL.createObjectURL(response.data);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName ?? `proof-${id}.bin`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);
  },

  fetchProofBlob: async (id: string): Promise<Blob> => {
    const { data } = await api.get<Blob>(`/quests/${id}/proof/preview`, {
      responseType: 'blob',
    });
    return data;
  },
};
