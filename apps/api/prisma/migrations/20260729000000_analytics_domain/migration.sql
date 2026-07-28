-- Phase 13 (Analytics & Business Intelligence domain). Hand-written rather than
-- `prisma migrate dev`, same shadow-database checksum-mismatch reason as every migration since
-- 20260724000000_checkout_payment_order.
--
-- Purely additive: four new single-column indexes, no data change, no column/table change. This
-- is ANALYTICS.md's Finding #1 — every analytics KPI is a date-range query, and none of these four
-- tables had a createdAt index before this migration. A plain column index lets Postgres
-- bitmap-scan it together with each table's existing status/foreign-key indexes rather than
-- requiring a composite index per filter combination. See DECISIONS.md ADR-020.

CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");
CREATE INDEX "Commission_createdAt_idx" ON "Commission"("createdAt");
CREATE INDEX "Refund_createdAt_idx" ON "Refund"("createdAt");
