-- Add PromoCode table for creator promo codes
CREATE TABLE "PromoCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL UNIQUE,
    "creatorId" TEXT NOT NULL,
    "offerId" TEXT,
    "discountPercentage" INTEGER DEFAULT 0,
    "discountMinor" INTEGER DEFAULT 0,
    "maxUses" INTEGER,
    "usesCount" INTEGER NOT NULL DEFAULT 0,
    "minPurchaseMinor" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'UZS',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PromoCode_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "CreatorProfile" ("id") ON DELETE CASCADE,
    CONSTRAINT "PromoCode_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer" ("id") ON DELETE SET NULL
);

CREATE INDEX "PromoCode_creatorId_idx" ON "PromoCode"("creatorId");
CREATE INDEX "PromoCode_offerId_idx" ON "PromoCode"("offerId");
CREATE INDEX "PromoCode_isActive_idx" ON "PromoCode"("isActive");

-- Add ReferralBonus table for tracking referral-based bonuses
CREATE TABLE "ReferralBonus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "referrerId" TEXT NOT NULL,
    "referredCreatorId" TEXT NOT NULL,
    "bonusAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'UZS',
    "ordersRequiredCount" INTEGER NOT NULL DEFAULT 1,
    "ordersCompletedCount" INTEGER NOT NULL DEFAULT 0,
    "totalRevenueMinor" INTEGER NOT NULL DEFAULT 0,
    "isUnlocked" BOOLEAN NOT NULL DEFAULT false,
    "unlockedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReferralBonus_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "CreatorProfile" ("id") ON DELETE CASCADE,
    CONSTRAINT "ReferralBonus_referredCreatorId_fkey" FOREIGN KEY ("referredCreatorId") REFERENCES "CreatorProfile" ("id") ON DELETE CASCADE
);

CREATE INDEX "ReferralBonus_referrerId_idx" ON "ReferralBonus"("referrerId");
CREATE INDEX "ReferralBonus_referredCreatorId_idx" ON "ReferralBonus"("referredCreatorId");
CREATE INDEX "ReferralBonus_isUnlocked_idx" ON "ReferralBonus"("isUnlocked");

-- Add column to Order for tracking promo code usage
ALTER TABLE "Order" ADD COLUMN "promoCodeId" TEXT;
ALTER TABLE "Order" ADD CONSTRAINT "Order_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode" ("id") ON DELETE SET NULL;
CREATE INDEX "Order_promoCodeId_idx" ON "Order"("promoCodeId");

-- Add column to Order for tracking referral bonus
ALTER TABLE "Order" ADD COLUMN "referralBonusId" TEXT;
ALTER TABLE "Order" ADD CONSTRAINT "Order_referralBonusId_fkey" FOREIGN KEY ("referralBonusId") REFERENCES "ReferralBonus" ("id") ON DELETE SET NULL;
CREATE INDEX "Order_referralBonusId_idx" ON "Order"("referralBonusId");

