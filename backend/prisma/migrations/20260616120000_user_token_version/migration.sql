-- 세션 폐기용 토큰 버전. 로그아웃 시 증가시켜 발급된 토큰을 즉시 무효화한다.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;
