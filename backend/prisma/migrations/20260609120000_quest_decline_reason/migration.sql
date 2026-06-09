-- 퀘스트 거부(사원이 수행 거부) 사유 컬럼 추가
-- status 5(거부됨)는 SmallInt 값이라 별도 스키마 변경이 없습니다.
ALTER TABLE "quests" ADD COLUMN IF NOT EXISTS "declineReason" TEXT;
