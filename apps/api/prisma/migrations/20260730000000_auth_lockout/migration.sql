-- Phase A (production-hardening pass). Hand-written rather than `prisma migrate dev`, same
-- shadow-database checksum-mismatch reason as every migration since 20260724000000_checkout_
-- payment_order.
--
-- Per-account brute-force login lockout — a sibling mitigation to the per-IP ThrottlerGuard limits
-- already on /auth/login, which alone don't slow a distributed attempt spread across many IPs
-- against one account. Purely additive: two new nullable/defaulted columns, no data change.

ALTER TABLE "User" ADD COLUMN     "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3);
