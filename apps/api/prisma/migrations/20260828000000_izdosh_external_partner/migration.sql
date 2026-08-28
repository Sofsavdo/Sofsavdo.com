-- Generalizes the external-redirect product mechanism (built for Fidem) to support a second
-- partner platform (Izdosh) — a Product's externalRedirectUrl alone doesn't say which partner's
-- click-token signing/verification and redirect query-param shape to use.

-- CreateEnum
CREATE TYPE "ExternalPartner" AS ENUM ('FIDEM', 'IZDOSH');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "externalPartner" "ExternalPartner";

-- Backfill: the only externalRedirectUrl product that predates this column is the Fidem one.
UPDATE "Product" SET "externalPartner" = 'FIDEM' WHERE "externalRedirectUrl" IS NOT NULL;
