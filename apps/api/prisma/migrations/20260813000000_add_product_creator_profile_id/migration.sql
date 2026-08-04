-- schema.prisma's Product model has had `creatorProfileId`/`creatorProfile` (added alongside the
-- Flow model, see 20260811000000_add_flow_model_and_commission_fields) since that migration's own
-- commit, but no migration ever actually added the column to the database -- confirmed by directly
-- querying information_schema.columns against the real Railway database: every other column
-- 20260811000000 introduced (commissionType/commissionRateBps/commissionAmountMinor) exists,
-- creatorProfileId does not. This is why ProductsService.create()/.list()/.listByCreator() (all of
-- which select or write creatorProfileId) would fail with "column does not exist" against any real
-- database -- reproduced live via prisma/seed.ts's seedCatalog(), which is what surfaced this.
ALTER TABLE "Product" ADD COLUMN "creatorProfileId" TEXT;

ALTER TABLE "Product" ADD CONSTRAINT "Product_creatorProfileId_fkey" FOREIGN KEY ("creatorProfileId") REFERENCES "CreatorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Product_creatorProfileId_idx" ON "Product"("creatorProfileId");
