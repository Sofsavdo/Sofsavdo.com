-- QuickProductLaunchForm (the one-screen admin "create product" flow) only ever wrote the
-- commission percentage/amount an admin enters onto the Campaign it auto-provisions, never onto
-- the Product itself -- even though Flow-based orders (the simplified architecture; see
-- orders.service.ts's resolveAttribution FLOW branch) price their Commission exclusively from
-- Product.commissionType/commissionRateBps/commissionAmountMinor, never from Campaign. Every
-- product created through that form therefore had a real, non-null commission on its Campaign but
-- NULL commission on the Product -- meaning any Flow-based sale of it would compute and pay out
-- exactly 0 commission to the creator, regardless of what the admin actually configured. Fixed at
-- the source in QuickProductLaunchForm.tsx/products.service.ts (this same change); this is the
-- one-time backfill for every product that got stuck this way before the fix. Never touches a
-- Product that already has its own commission configured, and never touches a Product with no
-- Campaign to backfill from.
UPDATE "Product" p
SET "commissionType" = c."commissionType"::text,
    "commissionRateBps" = c."commissionRateBps",
    "commissionAmountMinor" = c."commissionAmountMinor"
FROM "Offer" o
JOIN "Campaign" c ON c."offerId" = o.id
WHERE o."productId" = p.id
  AND p."commissionRateBps" IS NULL
  AND p."commissionAmountMinor" IS NULL;
