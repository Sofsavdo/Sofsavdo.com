-- Set when the creator says "I've added the link" — distinct from bioLinkVerified (the admin's
-- verdict). Without this, admin's pending-review queue had no way to tell a creator who hasn't
-- done anything yet apart from one who's asking for review.
ALTER TABLE "LaunchBonus" ADD COLUMN "bioLinkSubmittedAt" TIMESTAMP(3);
