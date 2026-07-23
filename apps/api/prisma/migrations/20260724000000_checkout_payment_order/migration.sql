-- Phase 8 (Checkout, Payment & Order domain). Hand-written rather than `prisma migrate dev`
-- because `migrate dev`'s shadow-database replay reported a false-positive "modified after
-- applied" checksum mismatch on an unrelated, already-applied historical migration (confirmed via
-- `prisma migrate status` that the live database has zero drift against all 7 prior migrations —
-- this file follows the exact `AlterEnum` pattern Prisma itself generated in
-- 20260718163000_campaign_domain_lifecycle/migration.sql for the same kind of enum-value swap).
-- No real Order/Payment/CommissionRule rows exist yet (OrdersService/PaymentsService didn't exist
-- before this phase — see PROJECT_STATUS.md), so every change below is a safe rename/narrowing,
-- not a destructive change to real data.

-- AlterEnum: OrderStatus — replaces the Phase 1 draft's NEW/CONFIRMED/COMPLETED/RETURNED with the
-- Phase 8 spec's explicit checkout-lifecycle state set. See DECISIONS.md ADR-015. Two columns use
-- this enum — Order.status and OrderStatusHistory.fromStatus/toStatus — both must be converted
-- before the old type can be dropped.
BEGIN;
CREATE TYPE "OrderStatus_new" AS ENUM ('CREATED', 'PAYMENT_PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED', 'REFUNDED');
ALTER TABLE "Order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "status" TYPE "OrderStatus_new" USING ("status"::text::"OrderStatus_new");
ALTER TABLE "OrderStatusHistory" ALTER COLUMN "fromStatus" TYPE "OrderStatus_new" USING ("fromStatus"::text::"OrderStatus_new");
ALTER TABLE "OrderStatusHistory" ALTER COLUMN "toStatus" TYPE "OrderStatus_new" USING ("toStatus"::text::"OrderStatus_new");
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "OrderStatus_old";
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'CREATED';
COMMIT;

-- AlterTable: Order — buyer's checkout-time delivery method choice (spec "Customer Information:
-- Delivery method"). `notes` already existed and is reused for "Notes".
ALTER TABLE "Order" ADD COLUMN "deliveryMethod" TEXT;

-- AlterTable: Product — physical-inventory tracking (spec "Stock available (if physical)" /
-- "reserve stock, prevent overselling"). null = untracked.
ALTER TABLE "Product" ADD COLUMN "stockQuantity" INTEGER;
ALTER TABLE "Product" ADD CONSTRAINT "Product_stock_non_negative_check" CHECK ("stockQuantity" IS NULL OR "stockQuantity" >= 0);

-- AlterTable: CommissionRule — realign field names/shape with Campaign's post-6B-Enhancement
-- commissionType/commissionRateBps/commissionAmountMinor convention (this model predates that
-- rename and had zero real rows, so this is a rename, not a breaking change). See DECISIONS.md
-- ADR-015.
ALTER TABLE "CommissionRule" RENAME COLUMN "commissionValue" TO "commissionRateBps";
ALTER TABLE "CommissionRule" ALTER COLUMN "commissionRateBps" DROP NOT NULL;
ALTER TABLE "CommissionRule" RENAME COLUMN "fixedPaymentMinor" TO "commissionAmountMinor";
