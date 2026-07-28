-- Phase 12 (Admin Operations domain). Hand-written rather than `prisma migrate dev`, same
-- shadow-database checksum-mismatch reason as every migration since 20260724000000_checkout_
-- payment_order. Everything below is additive only.

-- AlterEnum: UserStatus gains BLOCKED — additive (not a replace/narrow like Phase 8/9's
-- OrderStatus/PayoutStatus rewrites), so no CREATE TYPE ..._new / swap dance is needed.
ALTER TYPE "UserStatus" ADD VALUE 'BLOCKED';

-- AlterTable: User gains displayName (nullable — no backfill needed, existing rows simply have
-- no display name, matching the pre-existing frontend fallback to the email's local part).
ALTER TABLE "User" ADD COLUMN "displayName" TEXT;

-- AlterTable: Refund gains the admin review-decision fields (see DECISIONS.md ADR-019).
ALTER TABLE "Refund" ADD COLUMN "reviewedById" TEXT,
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "rejectionReason" TEXT;

-- CreateIndex
CREATE INDEX "Refund_status_idx" ON "Refund"("status");
