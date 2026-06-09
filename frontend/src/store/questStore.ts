import { create } from 'zustand';
import { questApi } from '../api/questApi';
import { useToastStore } from './toastStore';
import {
  QuestStatus,
  type AssigneeQuestStats,
  type CreateQuestPayload,
  type DeclineQuestPayload,
  type Quest,
  type QuestListParams,
  type QuestStats,
  type ReopenQuestPayload,
  type ReviewQuestPayload,
  type UpdateQuestPayload,
} from '../types/quest';

interface QuestState {
  quests: Quest[];
  page: number;
  totalPages: number;
  total: number;
  listParams: QuestListParams;
  stats: QuestStats | null;
  assigneeStats: AssigneeQuestStats[];
  loading: boolean;
  error: string | null;

  fetchQuests: (params?: Partial<QuestListParams>) => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchAssigneeStats: () => Promise<void>;
  createQuest: (payload: CreateQuestPayload) => Promise<Quest>;
  updateQuest: (id: string, payload: UpdateQuestPayload) => Promise<Quest>;
  deleteQuest: (id: string) => Promise<void>;
  startQuest: (id: string) => Promise<Quest>;
  declineQuest: (id: string, payload: DeclineQuestPayload) => Promise<Quest>;
  reopenQuest: (id: string, payload?: ReopenQuestPayload) => Promise<Quest>;
  uploadProof: (id: string, file: File, submissionNote?: string) => Promise<Quest>;
  reviewQuest: (id: string, payload: ReviewQuestPayload) => Promise<Quest>;
  upsertQuest: (quest: Quest) => void;
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

const toastErr = (e: unknown, fallback: string) => {
  const msg = extractErr(e);
  useToastStore.getState().push(msg || fallback, 'error');
  return msg || fallback;
};

export const useQuestStore = create<QuestState>((set, get) => ({
  quests: [],
  page: 1,
  totalPages: 0,
  total: 0,
  listParams: { page: 1, limit: 20 },
  stats: null,
  assigneeStats: [],
  loading: false,
  error: null,

  fetchQuests: async (params) => {
    const merged = { ...get().listParams, ...params };
    set({ loading: true, error: null, listParams: merged });
    try {
      const result = await questApi.list(merged);
      set({
        quests: result.items,
        page: result.page,
        totalPages: result.totalPages,
        total: result.total,
        loading: false,
      });
    } catch (e) {
      const msg = toastErr(e, '퀘스트 목록을 불러오지 못했습니다.');
      set({ loading: false, error: msg });
    }
  },

  fetchStats: async () => {
    try {
      const stats = await questApi.stats();
      set({ stats });
    } catch (e) {
      toastErr(e, '통계를 불러오지 못했습니다.');
    }
  },

  fetchAssigneeStats: async () => {
    try {
      const assigneeStats = await questApi.statsByAssignee();
      set({ assigneeStats });
    } catch {
      set({ assigneeStats: [] });
    }
  },

  upsertQuest: (quest) => {
    set({
      quests: get().quests.map((q) => (q.id === quest.id ? quest : q)),
    });
  },

  createQuest: async (payload) => {
    const created = await questApi.create(payload);
    await get().fetchQuests({ page: 1 });
    await get().fetchStats();
    useToastStore.getState().push('퀘스트가 발행되었습니다.', 'success');
    return created;
  },

  updateQuest: async (id, payload) => {
    try {
      const updated = await questApi.update(id, payload);
      get().upsertQuest(updated);
      useToastStore.getState().push('퀘스트가 수정되었습니다.', 'success');
      return updated;
    } catch (e) {
      toastErr(e, '수정에 실패했습니다.');
      throw e;
    }
  },

  deleteQuest: async (id) => {
    try {
      await questApi.delete(id);
      set({ quests: get().quests.filter((q) => q.id !== id) });
      await get().fetchStats();
      useToastStore.getState().push('퀘스트가 삭제되었습니다.', 'success');
    } catch (e) {
      toastErr(e, '삭제에 실패했습니다.');
      throw e;
    }
  },

  startQuest: async (id) => {
    try {
      const updated = await questApi.start(id);
      get().upsertQuest(updated);
      await get().fetchStats();
      useToastStore.getState().push('퀘스트를 착수했습니다.', 'success');
      return updated;
    } catch (e) {
      toastErr(e, '착수에 실패했습니다.');
      throw e;
    }
  },

  declineQuest: async (id, payload) => {
    try {
      const updated = await questApi.decline(id, payload);
      get().upsertQuest(updated);
      await get().fetchStats();
      useToastStore.getState().push('퀘스트를 거부했습니다.', 'success');
      return updated;
    } catch (e) {
      toastErr(e, '거부 처리에 실패했습니다.');
      throw e;
    }
  },

  reopenQuest: async (id, payload = {}) => {
    try {
      const updated = await questApi.reopen(id, payload);
      get().upsertQuest(updated);
      await get().fetchStats();
      useToastStore.getState().push('퀘스트를 재개봉했습니다.', 'success');
      return updated;
    } catch (e) {
      toastErr(e, '재개봉에 실패했습니다.');
      throw e;
    }
  },

  uploadProof: async (id, file, submissionNote) => {
    try {
      const updated = await questApi.uploadProof(id, file, submissionNote);
      get().upsertQuest(updated);
      await get().fetchStats();
      useToastStore.getState().push('증빙이 제출되었습니다.', 'success');
      return updated;
    } catch (e) {
      toastErr(e, '제출에 실패했습니다.');
      throw e;
    }
  },

  reviewQuest: async (id, payload) => {
    try {
      const updated = await questApi.review(id, payload);
      get().upsertQuest(updated);
      await get().fetchStats();
      useToastStore.getState().push(
        payload.status === QuestStatus.COMPLETED
          ? '승인되었습니다.'
          : '반려 처리되었습니다.',
        'success',
      );
      return updated;
    } catch (e) {
      toastErr(e, '검토에 실패했습니다.');
      throw e;
    }
  },
}));
