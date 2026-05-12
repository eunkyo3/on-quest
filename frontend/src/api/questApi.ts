import axios from 'axios';
import type {
  AssignableEmployee,
  AssigneeQuestStats,
  CreateQuestPayload,
  Quest,
  QuestStats,
  ReviewQuestPayload,
} from '../types/quest';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? '';
const TOKEN_KEY = 'onquest_access_token';

export const api = axios.create({
  baseURL: `${baseURL}/api`,
  timeout: 10_000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (
      typeof error === 'object' &&
      error !== null &&
      'response' in error &&
      (error as { response?: { status?: number } }).response?.status === 401
    ) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('onquest_user');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export const questApi = {
  list: async (): Promise<Quest[]> => {
    const { data } = await api.get<Quest[]>('/quests');
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
    const response = await api.get<Blob>(`/quests/${id}/proof`, {
      responseType: 'blob',
    });
    const blobUrl = window.URL.createObjectURL(response.data);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName ?? `proof-${id}.bin`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);
  },
};
