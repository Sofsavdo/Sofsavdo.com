-- Video-submission competitions (Instagram views metric) — participant review workflow.
-- CreateEnum
CREATE TYPE "CompetitionParticipantStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "CompetitionParticipant"
  ADD COLUMN "status" "CompetitionParticipantStatus" NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN "videoUrl" TEXT,
  ADD COLUMN "reviewNote" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "viewCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "viewCountUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "viewCountSource" TEXT;

-- CreateIndex
CREATE INDEX "CompetitionParticipant_status_idx" ON "CompetitionParticipant"("status");
