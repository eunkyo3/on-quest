export enum QuestStatus {
  PENDING = 0,
  IN_PROGRESS = 1,
  COMPLETED = 2,
  REJECTED = 3,
}

export const QUEST_STATUS_LABEL: Record<QuestStatus, string> = {
  [QuestStatus.PENDING]: '대기',
  [QuestStatus.IN_PROGRESS]: '검토 대기',
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
  /** 사원이 제출 시 작성한 선택 설명 */
  submissionNote: string | null;
  assigneeId: string;
  reviewerId: string | null;
  publisherSlackMemberId: string;
  companyCode: string;
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

/** 관리자용: 퀘스트 배정 이력이 있는 담당자(Slack ID)별 집계 */
export interface AssigneeQuestStats {
  assigneeId: string;
  assigneeName: string | null;
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  rejected: number;
  completionRate: number;
}

/** 관리자 발행 시 같은 회사 사원 선택용 */
export interface AssignableEmployee {
  id: string;
  name: string;
  email: string;
  slackMemberId: string;
}

export interface CreateQuestPayload {
  title: string;
  description: string;
  deadline: string;
  assigneeId: string;
}

export interface ReviewQuestPayload {
  status: QuestStatus.COMPLETED | QuestStatus.REJECTED;
  feedback?: string;
  reviewerId?: string;
}
