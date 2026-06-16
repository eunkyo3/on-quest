import axios from 'axios';
import type {
  AssignableEmployee,
  AssigneeQuestStats,
  BulkCreateResult,
  BulkQuestItem,
  CreateQuestPayload,
  DeclineQuestPayload,
  PaginatedQuests,
  Quest,
  QuestListParams,
  QuestStats,
  ReopenQuestPayload,
  ReviewQuestPayload,
  UpdateQuestPayload,
} from '../types/quest';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? '';
const TOKEN_KEY = 'onquest_access_token';

export const api = axios.create({
  baseURL: `${baseURL}/api`,
  timeout: 10_000,
  // refresh/logout 의 HttpOnly 쿠키를 주고받기 위해 자격증명 포함
  withCredentials: true,
});

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  // refresh token 은 HttpOnly 쿠키로만 전송된다 — 본문/스토리지에 담지 않는다.
  const { data } = await axios.post<{ accessToken: string }>(
    `${baseURL}/api/auth/refresh`,
    {},
    { withCredentials: true },
  );
  localStorage.setItem(TOKEN_KEY, data.accessToken);
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
      clearStoredSession();
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
      clearStoredSession();
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }
  },
);

function clearStoredSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('onquest_user');
}

export function persistAuthTokens(accessToken: string): void {
  localStorage.setItem(TOKEN_KEY, accessToken);
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

  bulkCreate: async (items: BulkQuestItem[]): Promise<BulkCreateResult> => {
    const { data } = await api.post<BulkCreateResult>('/quests/bulk', { items });
    return data;
  },

  exportCsv: async (params?: QuestListParams): Promise<void> => {
    const { data } = await api.get<Blob>('/quests/export', {
      params,
      responseType: 'blob',
    });
    const blobUrl = window.URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `quests-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);
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

  decline: async (id: string, payload: DeclineQuestPayload): Promise<Quest> => {
    const { data } = await api.post<Quest>(`/quests/${id}/decline`, payload);
    return data;
  },

  reopen: async (id: string, payload: ReopenQuestPayload = {}): Promise<Quest> => {
    const { data } = await api.post<Quest>(`/quests/${id}/reopen`, payload);
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
