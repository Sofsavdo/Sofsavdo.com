-- QuickProductLaunchForm (the one-screen admin "create product" flow) activates the Offer and
-- Campaign it creates alongside a Product in the same submit, but never activated the Product
-- itself -- so every product created through it stayed status=DRAFT forever, even with a fully
-- live Offer, and therefore never appeared to creators (ProductsService.listAvailableForPromotion
-- requires status=ACTIVE) or buyers. Fixed at the source in products.service.ts/
-- QuickProductLaunchForm.tsx (this same change); this is the one-time data repair for every
-- product that got stuck this way before the fix. Confirmed via direct query against the real
-- database: 8 products were affected there. Never touches a Product that has no live Offer --
-- those are genuinely unfinished (no price set yet), not stuck.
UPDATE "Product" p
SET status = 'ACTIVE'
WHERE p.status = 'DRAFT'
  AND EXISTS (SELECT 1 FROM "Offer" o WHERE o."productId" = p.id AND o.status = 'ACTIVE');
