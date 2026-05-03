/**
 * 퀘스트 상태 코드 (설계명세서 §클래스다이어그램 기준)
 * - 0: 대기    → 관리자가 생성만 하고 아직 진행되지 않음
 * - 1: 진행중  → 신입이 수락/착수한 상태
 * - 2: 완료    → 관리자 검토 후 승인된 상태
 * - 3: 반려    → 관리자 검토 결과 보완 요청된 상태
 */
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
