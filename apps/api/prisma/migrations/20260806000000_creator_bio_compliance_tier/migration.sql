-- Bio compliance + Premium tier (Phase Q).
-- CreateEnum
CREATE TYPE "BioComplianceStatus" AS ENUM ('PENDING', 'COMPLIANT', 'NON_COMPLIANT');

-- CreateEnum
CREATE TYPE "CreatorTier" AS ENUM ('STANDARD', 'PREMIUM');

-- AlterTable
ALTER TABLE "CreatorProfile" ADD COLUMN     "bioComplianceStatus" "BioComplianceStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "tier" "CreatorTier" NOT NULL DEFAULT 'STANDARD';
