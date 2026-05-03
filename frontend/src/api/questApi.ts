import axios from 'axios';
import type {
  CreateQuestPayload,
  Quest,
  QuestStats,
  ReviewQuestPayload,
} from '../types/quest';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? '';

export const api = axios.create({
  baseURL: `${baseURL}/api`,
  timeout: 10_000,
});

export const questApi = {
  list: async (): Promise<Quest[]> => {
    const { data } = await api.get<Quest[]>('/quests');
    return data;
  },

  stats: async (): Promise<QuestStats> => {
    const { data } = await api.get<QuestStats>('/quests/stats');
    return data;
  },

  create: async (payload: CreateQuestPayload): Promise<Quest> => {
    const { data } = await api.post<Quest>('/quests', payload);
    return data;
  },

  uploadProof: async (id: string, file: File): Promise<Quest> => {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post<Quest>(`/quests/${id}/proof`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  review: async (id: string, payload: ReviewQuestPayload): Promise<Quest> => {
    const { data } = await api.patch<Quest>(`/quests/${id}/review`, payload);
    return data;
  },

  proofDownloadUrl: (id: string): string => `${baseURL}/api/quests/${id}/proof`,
};
