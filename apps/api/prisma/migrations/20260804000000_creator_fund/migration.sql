-- Creator Motivation System: Creator Fund (Phase N).
-- AlterEnum
ALTER TYPE "CommissionStatus" ADD VALUE 'DONATED';

-- AlterEnum
ALTER TYPE "LedgerEntryType" ADD VALUE 'DONATION';

-- CreateTable
CREATE TABLE "CreatorFundContribution" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UZS',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorFundContribution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreatorFundContribution_creatorId_idx" ON "CreatorFundContribution"("creatorId");

-- CreateIndex
CREATE INDEX "CreatorFundContribution_createdAt_idx" ON "CreatorFundContribution"("createdAt");

-- AddForeignKey
ALTER TABLE "CreatorFundContribution" ADD CONSTRAINT "CreatorFundContribution_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "CreatorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Commission" ADD COLUMN     "donatedAt" TIMESTAMP(3),
ADD COLUMN     "fundContributionId" TEXT;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_fundContributionId_fkey" FOREIGN KEY ("fundContributionId") REFERENCES "CreatorFundContribution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
