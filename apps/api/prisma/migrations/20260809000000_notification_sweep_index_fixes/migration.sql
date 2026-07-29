-- Launch-readiness fix: NotificationSweepService's status-only sweeps had no time bound and no
-- supporting index for a global (non-creator-scoped) status filter on Payout/Commission.
-- AlterTable
ALTER TABLE "Payout" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Payout_status_updatedAt_idx" ON "Payout"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "Commission_status_updatedAt_idx" ON "Commission"("status", "updatedAt");
