export enum QuestStatus {
  PENDING = 0,
  IN_PROGRESS = 1,
  COMPLETED = 2,
  REJECTED = 3,
}

export const QUEST_STATUS_LABEL: Record<QuestStatus, string> = {
  [QuestStatus.PENDING]: '대기',
  [QuestStatus.IN_PROGRESS]: '진행중',
  [QuestStatus.COMPLETED]: '완료',
  [QuestStatus.REJECTED]: '반려',
};

export const QUEST_STATUS_COLOR: Record<QuestStatus, string> = {
  [QuestStatus.PENDING]: '#94a3b8',
  [QuestStatus.IN_PROGRESS]: '#3b82f6',
  [QuestStatus.COMPLETED]: '#10b981',
  [QuestStatus.REJECTED]: '#ef4444',
};

export interface Quest {
  id: string;
  title: string;
  description: string;
  deadline: string;
  status: QuestStatus;
  feedback: string | null;
  proofFileName: string | null;
  proofMimeType: string | null;
  hasProof: boolean;
  assigneeId: string | null;
  reviewerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuestStats {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  rejected: number;
  completionRate: number;
}

export interface CreateQuestPayload {
  title: string;
  description: string;
  deadline: string;
  assigneeId?: string;
}

export interface ReviewQuestPayload {
  status: QuestStatus.COMPLETED | QuestStatus.REJECTED;
  feedback?: string;
  reviewerId?: string;
}
