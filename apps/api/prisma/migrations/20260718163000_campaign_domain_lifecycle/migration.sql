-- Data migration first, while the old enum values are still valid: OPEN -> ACTIVE, CANCELLED ->
-- COMPLETED (best-fit mapping under the new 5-state model — see DECISIONS.md ADR-011). Must run
-- before the enum swap below or the USING cast on the next step fails for any existing OPEN row.
-- (archivedAt doesn't exist yet at this point in the migration, so it's set in a later step below
-- for any row that was CANCELLED.)
UPDATE "Campaign" SET "status" = 'ACTIVE' WHERE "status"::text = 'OPEN';
UPDATE "Campaign" SET "status" = 'COMPLETED' WHERE "status"::text = 'CANCELLED';

-- AlterEnum
BEGIN;
CREATE TYPE "CampaignStatus_new" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');
ALTER TABLE "public"."Campaign" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Campaign" ALTER COLUMN "status" TYPE "CampaignStatus_new" USING ("status"::text::"CampaignStatus_new");
ALTER TYPE "CampaignStatus" RENAME TO "CampaignStatus_old";
ALTER TYPE "CampaignStatus_new" RENAME TO "CampaignStatus";
DROP TYPE "public"."CampaignStatus_old";
ALTER TABLE "Campaign" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "applicationStartDate" TIMESTAMP(3),
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "category" TEXT,
ADD COLUMN     "contentDeadline" TIMESTAMP(3),
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "ctaLabel" TEXT,
ADD COLUMN     "internalName" TEXT,
ADD COLUMN     "internalNotes" TEXT,
ADD COLUMN     "maxFollowers" INTEGER,
ADD COLUMN     "minFollowers" INTEGER,
ADD COLUMN     "requiredContentCount" INTEGER,
ADD COLUMN     "updatedById" TEXT;

-- Backfill the two new NOT NULL-in-schema columns for any pre-existing row (the one seeded
-- Campaign), then enforce NOT NULL. Added as nullable above so the backfill itself is possible.
UPDATE "Campaign" SET "category" = 'general', "ctaLabel" = 'Qo''shilish' WHERE "category" IS NULL;
ALTER TABLE "Campaign" ALTER COLUMN "category" SET NOT NULL;
ALTER TABLE "Campaign" ALTER COLUMN "ctaLabel" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Campaign_offerId_idx" ON "Campaign"("offerId");

-- CreateIndex
CREATE INDEX "Campaign_archivedAt_idx" ON "Campaign"("archivedAt");

-- CreateIndex
CREATE INDEX "Campaign_startDate_endDate_idx" ON "Campaign"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "Campaign_applicationStartDate_applicationDeadline_idx" ON "Campaign"("applicationStartDate", "applicationDeadline");

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
