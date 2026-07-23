-- 6B Enhancement: Campaign media, commission modes, regional delivery, creator referral program.
--
-- Hand-adjusted from `prisma migrate diff` output. Three data-safety fixes over the raw diff:
--   1. Campaign commission: new explicit columns are added and BACKFILLED from the legacy
--      dual-meaning `commissionValue` BEFORE the legacy columns are dropped (the raw diff dropped
--      first, destroying data).
--   2. CommissionType enum narrowing: legacy values (FIXED_PER_SALE / FIXED_CONTENT_FEE / HYBRID)
--      are mapped to the surviving modes BEFORE the enum cast (the raw diff's bare cast would
--      fail if any such row existed).
--   3. CreatorProfile.referralCode: added nullable, backfilled with unique codes for existing
--      creators, then set NOT NULL (the raw diff's bare NOT NULL add would fail on existing rows).
-- Plus CHECK constraints and the partial COVER-uniqueness index Prisma cannot express.

-- CreateEnum
CREATE TYPE "DeliveryFeeType" AS ENUM ('FREE', 'FIXED');

-- CreateEnum
CREATE TYPE "DeliveryAvailability" AS ENUM ('AVAILABLE', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "CampaignMediaType" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "CampaignMediaRole" AS ENUM ('COVER', 'GALLERY', 'PROMOTIONAL');

-- CreateEnum
CREATE TYPE "ReferralRewardType" AS ENUM ('MILESTONE_FIXED', 'EARNINGS_PERCENTAGE');

-- CreateEnum
CREATE TYPE "ReferralMilestoneType" AS ENUM ('FIRST_APPROVED_CAMPAIGN_APPLICATION', 'FIRST_APPROVED_CONTENT', 'FIRST_QUALIFIED_SALE', 'FIRST_APPROVED_COMMISSION', 'MIN_CUMULATIVE_EARNINGS');

-- CreateEnum
CREATE TYPE "ReferralRewardStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PAID');

-- ── Campaign commission: add new explicit columns, backfill, then retire legacy columns ──

ALTER TABLE "Campaign"
  ADD COLUMN "commissionAmountMinor" INTEGER,
  ADD COLUMN "commissionCurrency" TEXT NOT NULL DEFAULT 'UZS',
  ADD COLUMN "commissionRateBps" INTEGER;

-- Backfill from the legacy dual-meaning commissionValue while it still exists.
UPDATE "Campaign" SET "commissionRateBps" = "commissionValue"
  WHERE "commissionType"::text IN ('PERCENTAGE', 'HYBRID') AND "commissionRateBps" IS NULL;
UPDATE "Campaign" SET "commissionAmountMinor" = "commissionValue"
  WHERE "commissionType"::text = 'FIXED_PER_SALE' AND "commissionAmountMinor" IS NULL;
UPDATE "Campaign" SET "commissionAmountMinor" = COALESCE(NULLIF("fixedPaymentMinor", 0), "commissionValue")
  WHERE "commissionType"::text = 'FIXED_CONTENT_FEE' AND "commissionAmountMinor" IS NULL;

-- Map legacy enum values onto the two surviving modes before the enum swap.
-- HYBRID keeps its percentage part (rate backfilled above); the two FIXED_* variants become
-- FIXED_AMOUNT. Real data check at migration time: the only real Campaign row was PERCENTAGE.
UPDATE "Campaign" SET "commissionType" = 'PERCENTAGE'
  WHERE "commissionType"::text = 'HYBRID';
UPDATE "Campaign" SET "commissionType" = 'FIXED_PER_SALE'
  WHERE "commissionType"::text = 'FIXED_CONTENT_FEE';
UPDATE "CommissionRule" SET "commissionType" = 'PERCENTAGE'
  WHERE "commissionType"::text = 'HYBRID';
UPDATE "CommissionRule" SET "commissionType" = 'FIXED_PER_SALE'
  WHERE "commissionType"::text = 'FIXED_CONTENT_FEE';

-- AlterEnum (FIXED_PER_SALE is renamed to FIXED_AMOUNT via the text mapping in the cast)
BEGIN;
CREATE TYPE "CommissionType_new" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');
ALTER TABLE "Campaign" ALTER COLUMN "commissionType" TYPE "CommissionType_new"
  USING (CASE "commissionType"::text WHEN 'FIXED_PER_SALE' THEN 'FIXED_AMOUNT' ELSE "commissionType"::text END::"CommissionType_new");
ALTER TABLE "CommissionRule" ALTER COLUMN "commissionType" TYPE "CommissionType_new"
  USING (CASE "commissionType"::text WHEN 'FIXED_PER_SALE' THEN 'FIXED_AMOUNT' ELSE "commissionType"::text END::"CommissionType_new");
ALTER TYPE "CommissionType" RENAME TO "CommissionType_old";
ALTER TYPE "CommissionType_new" RENAME TO "CommissionType";
DROP TYPE "public"."CommissionType_old";
COMMIT;

-- Retire the legacy columns only now that the new ones carry the data.
ALTER TABLE "Campaign" DROP COLUMN "commissionValue", DROP COLUMN "fixedPaymentMinor";

-- Mutual exclusivity of the two modes, at the database level.
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_commission_mode_check" CHECK (
  ("commissionType" = 'PERCENTAGE' AND "commissionRateBps" IS NOT NULL AND "commissionRateBps" > 0 AND "commissionAmountMinor" IS NULL)
  OR
  ("commissionType" = 'FIXED_AMOUNT' AND "commissionAmountMinor" IS NOT NULL AND "commissionAmountMinor" > 0 AND "commissionRateBps" IS NULL)
);

-- ── CreatorProfile.referralCode: add nullable → backfill unique codes → NOT NULL ──

ALTER TABLE "CreatorProfile" ADD COLUMN "referralCode" TEXT;

-- Deterministic-per-row but unguessable backfill: 8 uppercase chars from md5(id || random()).
UPDATE "CreatorProfile"
  SET "referralCode" = UPPER(SUBSTR(MD5("id" || RANDOM()::text), 1, 8))
  WHERE "referralCode" IS NULL;

ALTER TABLE "CreatorProfile" ALTER COLUMN "referralCode" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "CreatorProfile_referralCode_key" ON "CreatorProfile"("referralCode");

-- ── New tables ──

-- CreateTable
CREATE TABLE "OfferDeliveryRegion" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'UZ',
    "regionCode" TEXT NOT NULL,
    "regionName" TEXT NOT NULL,
    "availability" "DeliveryAvailability" NOT NULL DEFAULT 'AVAILABLE',
    "feeType" "DeliveryFeeType" NOT NULL,
    "deliveryFeeMinor" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'UZS',
    "estimatedMinDays" INTEGER,
    "estimatedMaxDays" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfferDeliveryRegion_pkey" PRIMARY KEY ("id")
);

-- FREE means genuinely free; FIXED means a real positive fee. Estimated-day window must be sane.
ALTER TABLE "OfferDeliveryRegion" ADD CONSTRAINT "OfferDeliveryRegion_fee_check" CHECK (
  ("feeType" = 'FREE' AND "deliveryFeeMinor" = 0)
  OR
  ("feeType" = 'FIXED' AND "deliveryFeeMinor" > 0)
);
ALTER TABLE "OfferDeliveryRegion" ADD CONSTRAINT "OfferDeliveryRegion_days_check" CHECK (
  "estimatedMinDays" IS NULL OR "estimatedMaxDays" IS NULL OR "estimatedMinDays" <= "estimatedMaxDays"
);

-- CreateTable
CREATE TABLE "CampaignMedia" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "mediaType" "CampaignMediaType" NOT NULL,
    "mediaRole" "CampaignMediaRole" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "durationSeconds" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "altText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignMedia_pkey" PRIMARY KEY ("id")
);

-- At most one COVER per campaign — partial unique index (not expressible in Prisma schema).
CREATE UNIQUE INDEX "CampaignMedia_cover_unique" ON "CampaignMedia"("campaignId") WHERE "mediaRole" = 'COVER';

-- CreateTable
CREATE TABLE "CreatorReferral" (
    "id" TEXT NOT NULL,
    "referrerCreatorId" TEXT NOT NULL,
    "referredCreatorId" TEXT NOT NULL,
    "referralCodeUsed" TEXT NOT NULL,
    "attributedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registeredAt" TIMESTAMP(3) NOT NULL,
    "onboardingCompletedAt" TIMESTAMP(3),
    "creatorApprovedAt" TIMESTAMP(3),
    "firstCampaignApplicationAt" TIMESTAMP(3),
    "firstApprovedCampaignApplicationAt" TIMESTAMP(3),
    "firstApprovedContentAt" TIMESTAMP(3),
    "firstQualifiedSaleAt" TIMESTAMP(3),
    "firstQualifiedEarningAt" TIMESTAMP(3),
    "qualifiedAt" TIMESTAMP(3),
    "disqualifiedAt" TIMESTAMP(3),
    "disqualificationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorReferral_pkey" PRIMARY KEY ("id")
);

-- No self-referral, at the database level.
ALTER TABLE "CreatorReferral" ADD CONSTRAINT "CreatorReferral_no_self_check" CHECK (
  "referrerCreatorId" <> "referredCreatorId"
);

-- CreateTable
CREATE TABLE "CreatorReferralRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rewardType" "ReferralRewardType" NOT NULL,
    "milestoneType" "ReferralMilestoneType",
    "fixedRewardMinor" INTEGER,
    "rewardRateBps" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'UZS',
    "qualifyingEarningsThresholdMinor" INTEGER,
    "earningWindowDays" INTEGER,
    "maximumRewardPerReferralMinor" INTEGER,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorReferralRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorReferralReward" (
    "id" TEXT NOT NULL,
    "referralId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "status" "ReferralRewardStatus" NOT NULL DEFAULT 'PENDING',
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "qualifiedEarningsMinor" INTEGER,
    "calculatedRewardMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UZS',
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorReferralReward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OfferDeliveryRegion_offerId_sortOrder_idx" ON "OfferDeliveryRegion"("offerId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "OfferDeliveryRegion_offerId_regionCode_key" ON "OfferDeliveryRegion"("offerId", "regionCode");

-- CreateIndex
CREATE INDEX "CampaignMedia_campaignId_sortOrder_idx" ON "CampaignMedia"("campaignId", "sortOrder");

-- CreateIndex
CREATE INDEX "CampaignMedia_campaignId_mediaRole_idx" ON "CampaignMedia"("campaignId", "mediaRole");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorReferral_referredCreatorId_key" ON "CreatorReferral"("referredCreatorId");

-- CreateIndex
CREATE INDEX "CreatorReferral_referrerCreatorId_createdAt_idx" ON "CreatorReferral"("referrerCreatorId", "createdAt");

-- CreateIndex
CREATE INDEX "CreatorReferralRule_active_startsAt_endsAt_idx" ON "CreatorReferralRule"("active", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "CreatorReferralReward_status_idx" ON "CreatorReferralReward"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorReferralReward_referralId_ruleId_sourceType_sourceId_key" ON "CreatorReferralReward"("referralId", "ruleId", "sourceType", "sourceId");

-- AddForeignKey
ALTER TABLE "OfferDeliveryRegion" ADD CONSTRAINT "OfferDeliveryRegion_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignMedia" ADD CONSTRAINT "CampaignMedia_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorReferral" ADD CONSTRAINT "CreatorReferral_referrerCreatorId_fkey" FOREIGN KEY ("referrerCreatorId") REFERENCES "CreatorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorReferral" ADD CONSTRAINT "CreatorReferral_referredCreatorId_fkey" FOREIGN KEY ("referredCreatorId") REFERENCES "CreatorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorReferralReward" ADD CONSTRAINT "CreatorReferralReward_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "CreatorReferral"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorReferralReward" ADD CONSTRAINT "CreatorReferralReward_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "CreatorReferralRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
