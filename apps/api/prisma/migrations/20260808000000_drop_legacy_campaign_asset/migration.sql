-- Repository cleanup (pre-production): drops the legacy CampaignAsset/FileAsset tables, mock-era
-- stubs superseded by CampaignMedia (the real vertical) and confirmed unreferenced by any service
-- in apps/api/src — see DECISIONS.md ADR-013 (original introduction) and the cleanup ADR for this
-- removal.
-- DropForeignKey
ALTER TABLE "CampaignAsset" DROP CONSTRAINT "CampaignAsset_campaignId_fkey";

-- DropForeignKey
ALTER TABLE "CampaignAsset" DROP CONSTRAINT "CampaignAsset_fileId_fkey";

-- DropTable
DROP TABLE "CampaignAsset";

-- DropTable
DROP TABLE "FileAsset";
