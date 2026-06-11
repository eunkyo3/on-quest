export enum QuestStatus {
  PENDING = 0,
  IN_PROGRESS = 1,
  SUBMITTED = 2,
  COMPLETED = 3,
  REJECTED = 4,
  DECLINED = 5,
}

export const QUEST_STATUS_LABEL: Record<QuestStatus, string> = {
  [QuestStatus.PENDING]: '대기',
  [QuestStatus.IN_PROGRESS]: '착수',
  [QuestStatus.SUBMITTED]: '검토 대기',
  [QuestStatus.COMPLETED]: '완료',
  [QuestStatus.REJECTED]: '반려',
  [QuestStatus.DECLINED]: '거부됨',
};

export const QUEST_STATUS_COLOR: Record<QuestStatus, string> = {
  [QuestStatus.PENDING]: '#94a3b8',
  [QuestStatus.IN_PROGRESS]: '#f59e0b',
  [QuestStatus.SUBMITTED]: '#3b82f6',
  [QuestStatus.COMPLETED]: '#10b981',
  [QuestStatus.REJECTED]: '#ef4444',
  [QuestStatus.DECLINED]: '#6b7280',
};

export interface Quest {
  id: string;
  title: string;
  description: string;
  deadline: string;
  status: QuestStatus;
  feedback: string | null;
  declineReason: string | null;
  proofFileName: string | null;
  proofMimeType: string | null;
  hasProof: boolean;
  submissionNote: string | null;
  assigneeId: string;
  assigneeName: string | null;
  reviewerId: string | null;
  publisherSlackMemberId: string;
  companyCode: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedQuests {
  items: Quest[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface QuestListParams {
  page?: number;
  limit?: number;
  status?: QuestStatus;
  assigneeId?: string;
  /** 제목·담당자 Slack ID 부분 일치 검색 */
  search?: string;
}

export interface QuestStats {
  total: number;
  pending: number;
  started: number;
  submitted: number;
  completed: number;
  rejected: number;
  declined: number;
  completionRate: number;
}

export interface AssigneeQuestStats {
  assigneeId: string;
  assigneeName: string | null;
  total: number;
  pending: number;
  started: number;
  submitted: number;
  completed: number;
  rejected: number;
  declined: number;
  completionRate: number;
}

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

export interface UpdateQuestPayload {
  title?: string;
  description?: string;
  deadline?: string;
}

export interface ReviewQuestPayload {
  status: QuestStatus.COMPLETED | QuestStatus.REJECTED;
  feedback?: string;
  reviewerId?: string;
}

export interface DeclineQuestPayload {
  reason: string;
}

export interface ReopenQuestPayload {
  /** 선택: 재개봉하며 다른 사원으로 재배정 */
  assigneeId?: string;
}

/** CSV 일괄 발행 항목 (담당자는 같은 회사 사원 이메일) */
export interface BulkQuestItem {
  title: string;
  description: string;
  deadline: string;
  assigneeEmail: string;
}

export interface BulkCreateResult {
  created: number;
  items: Quest[];
}

/** 증빙 업로드 허용 MIME (안내·검증용) */
export const ALLOWED_PROOF_ACCEPT =
  'image/jpeg,image/png,image/webp,image/gif,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt';
