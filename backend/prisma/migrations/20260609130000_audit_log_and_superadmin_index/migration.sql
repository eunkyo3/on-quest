-- 감사 로그 테이블
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id"          TEXT NOT NULL,
  "companyCode" VARCHAR(32) NOT NULL,
  "actorId"     VARCHAR(40) NOT NULL,
  "actorName"   VARCHAR(80) NOT NULL,
  "action"      VARCHAR(40) NOT NULL,
  "targetType"  VARCHAR(20) NOT NULL,
  "targetId"    VARCHAR(64),
  "detail"      TEXT,
  "createdAt"   TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "audit_logs_companyCode_createdAt_idx"
  ON "audit_logs" ("companyCode", "createdAt");

-- 회사코드당 슈퍼관리자는 최대 1명 (동시 최초 가입 경합 방지)
CREATE UNIQUE INDEX IF NOT EXISTS "users_one_superadmin_per_company"
  ON "users" ("companyCode")
  WHERE "role" = 'superadmin';
