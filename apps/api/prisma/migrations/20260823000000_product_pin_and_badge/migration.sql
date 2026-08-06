-- Admin product pinning (creator-facing product-picker ordering) + featured badge label.
-- AlterTable
ALTER TABLE "Product"
  ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "pinnedAt" TIMESTAMP(3),
  ADD COLUMN "featuredBadge" TEXT;

-- CreateIndex
CREATE INDEX "Product_isPinned_idx" ON "Product"("isPinned");
