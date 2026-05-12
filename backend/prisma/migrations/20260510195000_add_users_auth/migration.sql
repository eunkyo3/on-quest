-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(120) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "slackMemberId" VARCHAR(64) NOT NULL,
    "companyCode" VARCHAR(32) NOT NULL,
    "role" VARCHAR(20) NOT NULL DEFAULT 'employee',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_companyCode_key" ON "users"("email", "companyCode");

-- CreateIndex
CREATE UNIQUE INDEX "users_slackMemberId_companyCode_key" ON "users"("slackMemberId", "companyCode");

-- CreateIndex
CREATE INDEX "users_companyCode_idx" ON "users"("companyCode");
