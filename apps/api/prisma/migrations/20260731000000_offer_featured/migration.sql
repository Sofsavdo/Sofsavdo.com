-- Editorial curation flag for the public homepage's featured-products section (Phase C).
ALTER TABLE "Offer" ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Offer_isFeatured_status_idx" ON "Offer"("isFeatured", "status");
