-- CreateTable
CREATE TABLE "quests" (
    "id" VARCHAR(8) NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" TEXT NOT NULL,
    "deadline" TIMESTAMPTZ(6) NOT NULL,
    "status" SMALLINT NOT NULL DEFAULT 0,
    "feedback" TEXT,
    "proofData" BYTEA,
    "proofMimeType" VARCHAR(255),
    "proofFileName" VARCHAR(255),
    "assigneeId" VARCHAR(64),
    "reviewerId" VARCHAR(64),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "quests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quests_status_idx" ON "quests"("status");
