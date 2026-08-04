-- Comprehensive catch-up for schema.prisma vs. the real database having drifted apart over
-- several prior sessions -- confirmed via `prisma migrate diff` comparing the live database
-- directly against the current schema (not just the applied-migrations history, which reported
-- "up to date" the whole time since it only tracks which migration *files* ran, not whether the
-- schema and database actually still agree). This single migration is exactly that diff's output.
--
-- The two headline gaps this closes, both confirmed live via a real end-to-end checkout attempt:
--   1. LaunchBonusSettings/LaunchBonus/CompetitionParticipant/BonusStatus never existed in the
--      database at all -- the entire Launch Bonus feature (admin + creator, both nav-linked) has
--      been silently running on the frontend's own hardcoded fallback numbers
--      (LaunchBonusProgress.tsx's DEFAULT_BONUS_AMOUNT etc.) because every real API call to it
--      must have been failing, and Competition "join" tracking had nothing to write to.
--   2. Payment.merchantReference doesn't exist -- every checkout's final response-read query
--      500'd on any product, Flow-attributed or not (see the two migrations immediately before
--      this one for the other two blockers found in the same checkout call: Product.creatorProfileId
--      and AttributionSource missing FLOW).

-- CreateEnum
CREATE TYPE "BonusStatus" AS ENUM ('LOCKED', 'UNLOCKED', 'EXPIRED');

-- DropForeignKey
ALTER TABLE "Commission" DROP CONSTRAINT "Commission_commissionRuleId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_offerId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_productId_fkey";

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "offerId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "merchantReference" TEXT;

-- AlterTable
ALTER TABLE "Payout" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "commissionType" SET DEFAULT 'PERCENTAGE';

-- CreateTable
CREATE TABLE "LaunchBonusSettings" (
    "id" TEXT NOT NULL,
    "bonusAmountMinor" INTEGER NOT NULL DEFAULT 150000000,
    "referralBonusAmountMinor" INTEGER NOT NULL DEFAULT 250000000,
    "deadlineDays" INTEGER NOT NULL DEFAULT 30,
    "minCommissionMinor" INTEGER DEFAULT 500000000,
    "minReferrals" INTEGER DEFAULT 3,
    "minOrders" INTEGER DEFAULT 5,
    "bioLinkRequired" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaunchBonusSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaunchBonus" (
    "id" TEXT NOT NULL,
    "creatorProfileId" TEXT NOT NULL,
    "settingsId" TEXT NOT NULL,
    "bonusAmountMinor" INTEGER NOT NULL,
    "status" "BonusStatus" NOT NULL DEFAULT 'LOCKED',
    "deadline" TIMESTAMP(3) NOT NULL,
    "commissionEarnedMinor" INTEGER NOT NULL DEFAULT 0,
    "referralsCount" INTEGER NOT NULL DEFAULT 0,
    "ordersCount" INTEGER NOT NULL DEFAULT 0,
    "bioLinkVerified" BOOLEAN NOT NULL DEFAULT false,
    "bioLinkVerifiedAt" TIMESTAMP(3),
    "bioLinkVerifiedBy" TEXT,
    "unlockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaunchBonus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionParticipant" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitionParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LaunchBonus_creatorProfileId_key" ON "LaunchBonus"("creatorProfileId");

-- CreateIndex
CREATE INDEX "LaunchBonus_status_idx" ON "LaunchBonus"("status");

-- CreateIndex
CREATE INDEX "LaunchBonus_deadline_idx" ON "LaunchBonus"("deadline");

-- CreateIndex
CREATE INDEX "CompetitionParticipant_competitionId_idx" ON "CompetitionParticipant"("competitionId");

-- CreateIndex
CREATE INDEX "CompetitionParticipant_creatorId_idx" ON "CompetitionParticipant"("creatorId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitionParticipant_competitionId_creatorId_key" ON "CompetitionParticipant"("competitionId", "creatorId");

-- CreateIndex
CREATE INDEX "Flow_status_idx" ON "Flow"("status");

-- CreateIndex
CREATE INDEX "Flow_referralCode_idx" ON "Flow"("referralCode");

-- CreateIndex
CREATE INDEX "Order_productId_idx" ON "Order"("productId");

-- CreateIndex
CREATE INDEX "Payment_merchantReference_idx" ON "Payment"("merchantReference");

-- AddForeignKey
ALTER TABLE "LaunchBonus" ADD CONSTRAINT "LaunchBonus_creatorProfileId_fkey" FOREIGN KEY ("creatorProfileId") REFERENCES "CreatorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchBonus" ADD CONSTRAINT "LaunchBonus_settingsId_fkey" FOREIGN KEY ("settingsId") REFERENCES "LaunchBonusSettings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchBonus" ADD CONSTRAINT "LaunchBonus_bioLinkVerifiedBy_fkey" FOREIGN KEY ("bioLinkVerifiedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionParticipant" ADD CONSTRAINT "CompetitionParticipant_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionParticipant" ADD CONSTRAINT "CompetitionParticipant_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "CreatorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_commissionRuleId_fkey" FOREIGN KEY ("commissionRuleId") REFERENCES "CommissionRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
