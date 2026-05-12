-- 발행자 Slack ID / 회사코드 / 담당자 필수화
ALTER TABLE "quests" ADD COLUMN "publisherSlackMemberId" VARCHAR(64);
ALTER TABLE "quests" ADD COLUMN "companyCode" VARCHAR(32);

-- 기존 행 보정 (로컬·개발용 기본값)
UPDATE "quests"
SET
  "publisherSlackMemberId" = COALESCE("publisherSlackMemberId", 'UNKNOWN'),
  "companyCode" = COALESCE("companyCode", 'default'),
  "assigneeId" = COALESCE("assigneeId", 'UNKNOWN');

ALTER TABLE "quests" ALTER COLUMN "publisherSlackMemberId" SET NOT NULL;
ALTER TABLE "quests" ALTER COLUMN "companyCode" SET NOT NULL;
ALTER TABLE "quests" ALTER COLUMN "assigneeId" SET NOT NULL;

CREATE INDEX "quests_companyCode_idx" ON "quests"("companyCode");
CREATE INDEX "quests_companyCode_assigneeId_idx" ON "quests"("companyCode", "assigneeId");
