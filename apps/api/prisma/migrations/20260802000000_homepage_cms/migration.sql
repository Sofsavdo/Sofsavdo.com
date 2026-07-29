-- Homepage CMS (Phase H): flat, parent-less section table for the public homepage — see
-- DECISIONS.md ADR-027. Deliberately ships with NO seed rows: apps/web/app/page.tsx renders its
-- existing fixed component tree whenever this table is empty (a fresh/unconfigured environment),
-- so there is no visual regression and no risky raw-SQL data insert in a schema migration. Default
-- rows for local development/demoing the builder come from prisma/seed.ts instead.
-- CreateEnum
CREATE TYPE "HomepageSectionType" AS ENUM ('HERO', 'WHY_SOFSAVDO', 'FEATURED_PRODUCTS', 'BANNER', 'CREATOR_PROGRAM_BLURB', 'BENEFITS', 'FAQ', 'SUPPORT', 'CUSTOM_RICH_TEXT', 'CATEGORY_GRID');

-- CreateTable
CREATE TABLE "HomepageSection" (
    "id" TEXT NOT NULL,
    "type" "HomepageSectionType" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "content" JSONB NOT NULL,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomepageSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HomepageSection_sortOrder_idx" ON "HomepageSection"("sortOrder");
