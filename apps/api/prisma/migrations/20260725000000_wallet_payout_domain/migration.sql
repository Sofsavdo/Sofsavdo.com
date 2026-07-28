-- Phase 9 (Wallet, Commission Settlement & Payout domain). Hand-written rather than
-- `prisma migrate dev`, mirroring 20260724000000_checkout_payment_order/migration.sql's own note:
-- that command's shadow-database replay previously reported a false-positive checksum mismatch
-- unrelated to this change. No real Payout rows exist yet (no PayoutsService existed before this
-- phase — see PROJECT_STATUS.md), so this enum replacement is a safe rename/narrowing.

-- AlterEnum: PayoutStatus — replaces the Phase 1 draft's UNDER_REVIEW-inclusive set with the
-- Phase 9 spec's explicit withdrawal-workflow states. See DECISIONS.md ADR-016.
BEGIN;
CREATE TYPE "PayoutStatus_new" AS ENUM ('REQUESTED', 'APPROVED', 'PROCESSING', 'PAID', 'REJECTED', 'CANCELLED', 'FAILED');
ALTER TABLE "Payout" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Payout" ALTER COLUMN "status" TYPE "PayoutStatus_new" USING ("status"::text::"PayoutStatus_new");
ALTER TYPE "PayoutStatus" RENAME TO "PayoutStatus_old";
ALTER TYPE "PayoutStatus_new" RENAME TO "PayoutStatus";
DROP TYPE "PayoutStatus_old";
ALTER TABLE "Payout" ALTER COLUMN "status" SET DEFAULT 'REQUESTED';
COMMIT;
