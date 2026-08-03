-- Add commission fields to Product model
ALTER TABLE "Product" ADD COLUMN "commissionType" TEXT;
ALTER TABLE "Product" ADD COLUMN "commissionRateBps" INTEGER;
ALTER TABLE "Product" ADD COLUMN "commissionAmountMinor" INTEGER;

-- Add FLOW to AttributionSource enum (PostgreSQL doesn't support enum alteration directly, need to recreate)
-- For now, we'll handle this in the application layer

-- Add Flow model
CREATE TABLE "Flow" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "creatorProfileId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "orderCount" INTEGER NOT NULL DEFAULT 0,
    "commissionEarnedMinor" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Flow_pkey" PRIMARY KEY ("id")
);

-- Add unique constraint for referralCode
CREATE UNIQUE INDEX "Flow_referralCode_key" ON "Flow"("referralCode");

-- Add unique constraint for creatorProfileId + productId combination
CREATE UNIQUE INDEX "Flow_creatorProfileId_productId_key" ON "Flow"("creatorProfileId", "productId");

-- Add indexes
CREATE INDEX "Flow_creatorProfileId_idx" ON "Flow"("creatorProfileId");
CREATE INDEX "Flow_productId_idx" ON "Flow"("productId");

-- Add foreign key constraints
ALTER TABLE "Flow" ADD CONSTRAINT "Flow_creatorProfileId_fkey" FOREIGN KEY ("creatorProfileId") REFERENCES "CreatorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Flow" ADD CONSTRAINT "Flow_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add Flow relation to CreatorProfile (already has flows relation in schema, just need to ensure FK exists)
-- This is handled by the Flow creatorProfileId FK above

-- Update Order model to add Flow and referral fields
ALTER TABLE "Order" ADD COLUMN "flowId" TEXT;
ALTER TABLE "Order" ADD COLUMN "referralCode" TEXT;
ALTER TABLE "Order" ADD COLUMN "productId" TEXT;

-- Add foreign key for flowId
ALTER TABLE "Order" ADD CONSTRAINT "Order_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "Flow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add foreign key for productId
ALTER TABLE "Order" ADD CONSTRAINT "Order_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add index for flowId
CREATE INDEX "Order_flowId_idx" ON "Order"("flowId");

-- Make campaignId nullable in Attribution model
ALTER TABLE "Attribution" ALTER COLUMN "campaignId" DROP NOT NULL;
ALTER TABLE "Attribution" ALTER COLUMN "offerId" DROP NOT NULL;

-- Make commissionRuleId nullable in Commission model
ALTER TABLE "Commission" ALTER COLUMN "commissionRuleId" DROP NOT NULL;
