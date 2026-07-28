-- Phase 11 (Creator Onboarding & Admin Review domain). Hand-written rather than `prisma migrate
-- dev`, same shadow-database checksum-mismatch reason as every migration since
-- 20260724000000_checkout_payment_order.

-- AlterEnum: CreatorApplicationStatus.REVISION_REQUESTED -> CHANGES_REQUESTED — same swap-dance
-- Prisma itself generates for any enum value change (see
-- 20260721060000_creator_application_lifecycle/migration.sql for the identical pattern applied to
-- CampaignApplicationStatus). The USING clause below maps any pre-existing REVISION_REQUESTED row
-- to CHANGES_REQUESTED directly during the cast — no real row has ever carried the old value
-- (confirmed by grep across apps/api/src: the only reference outside this schema/migration was a
-- comment), so this is expected to be a no-op data-wise, not a real backfill. See DECISIONS.md
-- ADR-018.
BEGIN;
CREATE TYPE "CreatorApplicationStatus_new" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED');
ALTER TABLE "CreatorApplication" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "CreatorApplication" ALTER COLUMN "status" TYPE "CreatorApplicationStatus_new" USING (
  (CASE WHEN "status"::text = 'REVISION_REQUESTED' THEN 'CHANGES_REQUESTED' ELSE "status"::text END)::"CreatorApplicationStatus_new"
);
ALTER TYPE "CreatorApplicationStatus" RENAME TO "CreatorApplicationStatus_old";
ALTER TYPE "CreatorApplicationStatus_new" RENAME TO "CreatorApplicationStatus";
DROP TYPE "public"."CreatorApplicationStatus_old";
ALTER TABLE "CreatorApplication" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;
