-- Add customPromoCode field to CreatorProfile
ALTER TABLE "CreatorProfile" ADD COLUMN "customPromoCode" TEXT;

-- Add unique constraint for customPromoCode
CREATE UNIQUE INDEX "CreatorProfile_customPromoCode_key" ON "CreatorProfile"("customPromoCode");
