-- Repository cleanup (pre-production): drops the legacy CreatorContent table, a mock-era stub
-- superseded by the real Content vertical (Phase 7A) and confirmed unreferenced by any service in
-- apps/api/src — see DECISIONS.md ADR-014 (original introduction) and the cleanup ADR for this
-- removal.
-- DropForeignKey
ALTER TABLE "CreatorContent" DROP CONSTRAINT "CreatorContent_creatorCampaignId_fkey";

-- DropForeignKey
ALTER TABLE "CreatorContent" DROP CONSTRAINT "CreatorContent_creatorId_fkey";

-- DropTable
DROP TABLE "CreatorContent";

-- DropEnum
DROP TYPE "CreatorContentStatus";
