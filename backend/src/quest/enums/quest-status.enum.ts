/**
 * 퀘스트 상태 v2
 * - 0: 대기 (배정만 됨)
 * - 1: 착수 (사원이 업무 시작)
 * - 2: 검토 대기 (증빙 제출됨)
 * - 3: 완료
 * - 4: 반려 (관리자가 검토 후 반려)
 * - 5: 거부됨 (사원이 수행 자체를 거부)
 */
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

/** 검토 대기·반려 등 관리자 검토가 필요한 상태 */
export const REVIEWABLE_STATUSES: QuestStatus[] = [
  QuestStatus.SUBMITTED,
  QuestStatus.REJECTED,
];
