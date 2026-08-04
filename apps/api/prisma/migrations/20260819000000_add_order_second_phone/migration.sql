-- Optional second contact phone number captured at checkout — a courier backup contact, kept
-- per-order (not on Customer) since it's delivery-specific rather than part of the buyer's
-- lasting identity.
ALTER TABLE "Order" ADD COLUMN "secondPhone" TEXT;
