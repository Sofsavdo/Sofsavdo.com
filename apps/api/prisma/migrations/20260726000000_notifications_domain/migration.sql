-- Phase 10 (Communication & Notification domain). Hand-written rather than `prisma migrate dev`,
-- same shadow-database checksum-mismatch reason as every migration since
-- 20260724000000_checkout_payment_order. Everything below is additive only — `Notification` and
-- `User` both predate this phase (Phase 1 draft models, `Notification` reserved-unused until now,
-- same "extend, never supersede" precedent as every prior phase's pre-designed models) and no real
-- Notification/NotificationPreference row exists yet, so nothing here touches live data. See
-- DECISIONS.md ADR-017.

-- AlterEnum: NotificationChannel gains EMAIL — additive (not a replace/narrow like Phase 8/9's
-- OrderStatus/PayoutStatus rewrites), so no CREATE TYPE ..._new / swap dance is needed; the
-- existing IN_APP/TELEGRAM values and every column using them are untouched.
ALTER TYPE "NotificationChannel" ADD VALUE 'EMAIL';

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('CAMPAIGN_APPLICATION', 'ORDER', 'COMMISSION', 'PAYOUT', 'ACCOUNT', 'ADMIN_ALERTS');

-- AlterTable: User — set once a user links their Telegram account (see DECISIONS.md ADR-017).
ALTER TABLE "User" ADD COLUMN "telegramChatId" TEXT;
CREATE UNIQUE INDEX "User_telegramChatId_key" ON "User"("telegramChatId");

-- AlterTable: Notification — delivery-status/retry tracking (TELEGRAM/EMAIL only; IN_APP rows are
-- created directly as SENT) plus a deterministic dedup key the Phase 8/9 sweep relies on for
-- idempotent rescanning (see NotificationSweepService).
ALTER TABLE "Notification" ADD COLUMN "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Notification" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Notification" ADD COLUMN "lastAttemptAt" TIMESTAMP(3);
ALTER TABLE "Notification" ADD COLUMN "error" TEXT;
ALTER TABLE "Notification" ADD COLUMN "dedupKey" TEXT;
CREATE UNIQUE INDEX "Notification_dedupKey_key" ON "Notification"("dedupKey");
CREATE INDEX "Notification_channel_status_idx" ON "Notification"("channel", "status");

-- CreateTable: NotificationPreference — one row per (user, category) the user has explicitly
-- touched; an absent row means "use the default" (in-app on, telegram off, email on — every email
-- this domain sends is transactional, never marketing, so opt-out rather than opt-in is the safe
-- default; telegram defaults off since it additionally requires a linked telegramChatId to ever
-- deliver anything).
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "inApp" BOOLEAN NOT NULL DEFAULT true,
    "telegram" BOOLEAN NOT NULL DEFAULT false,
    "email" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationPreference_userId_category_key" ON "NotificationPreference"("userId", "category");

ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
