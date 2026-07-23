-- AlterEnum
BEGIN;
CREATE TYPE "CampaignApplicationStatus_new" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED', 'WITHDRAWN');
ALTER TABLE "public"."CampaignApplication" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "CampaignApplication" ALTER COLUMN "status" TYPE "CampaignApplicationStatus_new" USING ("status"::text::"CampaignApplicationStatus_new");
ALTER TYPE "CampaignApplicationStatus" RENAME TO "CampaignApplicationStatus_old";
ALTER TYPE "CampaignApplicationStatus_new" RENAME TO "CampaignApplicationStatus";
DROP TYPE "public"."CampaignApplicationStatus_old";
ALTER TABLE "CampaignApplication" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- AlterTable
ALTER TABLE "CampaignApplication" ADD COLUMN     "adminNotes" TEXT,
ADD COLUMN     "answers" JSONB,
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "changesRequestedReason" TEXT,
ADD COLUMN     "contentFormat" TEXT,
ADD COLUMN     "followerSnapshot" INTEGER,
ADD COLUMN     "platform" "SocialPlatform",
ADD COLUMN     "portfolioLinks" TEXT[],
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "sampleContentLinks" TEXT[],
ADD COLUMN     "submittedAt" TIMESTAMP(3),
-- Backfilled from createdAt for any pre-existing row (the two seeded APPROVED applications),
-- then enforced NOT NULL — added nullable-with-default first is not possible in one statement
-- alongside the backfill, so this splits into add -> backfill -> enforce below.
ADD COLUMN     "updatedAt" TIMESTAMP(3),
ADD COLUMN     "withdrawnAt" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'DRAFT';

UPDATE "CampaignApplication" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;
ALTER TABLE "CampaignApplication" ALTER COLUMN "updatedAt" SET NOT NULL;

-- CreateIndex
CREATE INDEX "CampaignApplication_campaignId_idx" ON "CampaignApplication"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignApplication_creatorId_idx" ON "CampaignApplication"("creatorId");

-- CreateIndex
CREATE INDEX "CampaignApplication_createdAt_idx" ON "CampaignApplication"("createdAt");

-- CreateIndex
CREATE INDEX "CampaignApplication_submittedAt_idx" ON "CampaignApplication"("submittedAt");

-- CreateIndex
CREATE INDEX "CampaignApplication_reviewedAt_idx" ON "CampaignApplication"("reviewedAt");

-- AddForeignKey
ALTER TABLE "CampaignApplication" ADD CONSTRAINT "CampaignApplication_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
