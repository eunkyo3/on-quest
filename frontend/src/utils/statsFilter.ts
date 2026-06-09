import { QuestStatus, type QuestStats } from '../types/quest';

export type StatsFilterKey =
  | 'all'
  | 'pending'
  | 'started'
  | 'submitted'
  | 'completed'
  | 'rejected'
  | 'declined';

export const STATS_FILTER_LABEL: Record<StatsFilterKey, string> = {
  all: '전체',
  pending: '대기',
  started: '착수',
  submitted: '검토 대기',
  completed: '완료',
  rejected: '반려',
  declined: '거부됨',
};

export const STATS_FILTER_TO_STATUS: Record<StatsFilterKey, QuestStatus | undefined> = {
  all: undefined,
  pending: QuestStatus.PENDING,
  started: QuestStatus.IN_PROGRESS,
  submitted: QuestStatus.SUBMITTED,
  completed: QuestStatus.COMPLETED,
  rejected: QuestStatus.REJECTED,
  declined: QuestStatus.DECLINED,
};

export function countForFilter(stats: QuestStats, key: StatsFilterKey): number {
  switch (key) {
    case 'all':
      return stats.total;
    case 'pending':
      return stats.pending;
    case 'started':
      return stats.started;
    case 'submitted':
      return stats.submitted;
    case 'completed':
      return stats.completed;
    case 'rejected':
      return stats.rejected;
    case 'declined':
      return stats.declined;
    default:
      return 0;
  }
}

export const STATS_FILTER_KEYS: StatsFilterKey[] = [
  'all',
  'completed',
  'submitted',
  'started',
  'pending',
  'rejected',
  'declined',
];

export function assigneeStatsToQuestStats(row: {
  total: number;
  pending: number;
  started: number;
  submitted: number;
  completed: number;
  rejected: number;
  declined: number;
  completionRate: number;
}): QuestStats {
  return {
    total: row.total,
    pending: row.pending,
    started: row.started,
    submitted: row.submitted,
    completed: row.completed,
    rejected: row.rejected,
    declined: row.declined,
    completionRate: row.completionRate,
  };
}
