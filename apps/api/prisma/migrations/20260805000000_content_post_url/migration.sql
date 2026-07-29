-- Contractual post verification (Phase P): the live social-media post URL, alongside the
-- existing screenshot attachment requirement.
-- AlterTable
ALTER TABLE "Content" ADD COLUMN     "postUrl" TEXT;

-- AlterTable
ALTER TABLE "ContentVersion" ADD COLUMN     "postUrl" TEXT;
