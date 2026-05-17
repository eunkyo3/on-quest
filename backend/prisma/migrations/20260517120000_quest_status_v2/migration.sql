-- 상태 v2: 0 대기 / 1 착수 / 2 검토대기 / 3 완료 / 4 반려
UPDATE "quests" SET "status" = CASE
  WHEN "status" = 0 THEN 0
  WHEN "status" = 1 THEN 2
  WHEN "status" = 2 THEN 3
  WHEN "status" = 3 THEN 4
  ELSE "status"
END;

ALTER TABLE "quests" ADD COLUMN IF NOT EXISTS "deadlineSoonNotifiedAt" TIMESTAMPTZ(6);
ALTER TABLE "quests" ADD COLUMN IF NOT EXISTS "overdueNotifiedAt" TIMESTAMPTZ(6);
