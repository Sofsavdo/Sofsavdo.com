-- Partner-platform (Fidem) commission attribution: a Commission can now come from a webhook-
-- reported external conversion instead of a real Sofsavdo Order, and a Product can point a
-- Flow click straight at a partner platform instead of Sofsavdo's own checkout.

-- CreateEnum
CREATE TYPE "CommissionSource" AS ENUM ('ORDER', 'EXTERNAL');

-- AlterTable
ALTER TABLE "Commission"
  ALTER COLUMN "orderId" DROP NOT NULL,
  ADD COLUMN "source" "CommissionSource" NOT NULL DEFAULT 'ORDER',
  ADD COLUMN "externalRef" TEXT,
  ADD COLUMN "externalDescription" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Commission_externalRef_key" ON "Commission"("externalRef");

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "externalRedirectUrl" TEXT;
