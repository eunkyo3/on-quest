import { create } from 'zustand';
import { questApi } from '../api/questApi';
import type {
  CreateQuestPayload,
  Quest,
  QuestStats,
  ReviewQuestPayload,
} from '../types/quest';

interface QuestState {
  quests: Quest[];
  stats: QuestStats | null;
  loading: boolean;
  error: string | null;

  fetchQuests: () => Promise<void>;
  fetchStats: () => Promise<void>;
  createQuest: (payload: CreateQuestPayload) => Promise<Quest>;
  uploadProof: (id: string, file: File) => Promise<Quest>;
  reviewQuest: (id: string, payload: ReviewQuestPayload) => Promise<Quest>;
}

const extractErr = (e: unknown): string => {
  if (typeof e === 'object' && e !== null && 'response' in e) {
    const resp = (e as { response?: { data?: { message?: unknown } } }).response;
    const msg = resp?.data?.message;
    if (Array.isArray(msg)) return msg.join(', ');
    if (typeof msg === 'string') return msg;
  }
  return e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.';
};

export const useQuestStore = create<QuestState>((set, get) => ({
  quests: [],
  stats: null,
  loading: false,
  error: null,

  fetchQuests: async () => {
    set({ loading: true, error: null });
    try {
      const quests = await questApi.list();
      set({ quests, loading: false });
    } catch (e) {
      set({ loading: false, error: extractErr(e) });
    }
  },

  fetchStats: async () => {
    try {
      const stats = await questApi.stats();
      set({ stats });
    } catch (e) {
      set({ error: extractErr(e) });
    }
  },

  createQuest: async (payload) => {
    const created = await questApi.create(payload);
    set({ quests: [created, ...get().quests] });
    await get().fetchStats();
    return created;
  },

  uploadProof: async (id, file) => {
    const updated = await questApi.uploadProof(id, file);
    set({
      quests: get().quests.map((q) => (q.id === id ? updated : q)),
    });
    await get().fetchStats();
    return updated;
  },

  reviewQuest: async (id, payload) => {
    const updated = await questApi.review(id, payload);
    set({
      quests: get().quests.map((q) => (q.id === id ? updated : q)),
    });
    await get().fetchStats();
    return updated;
  },
}));
