/**
 * One-off: creates the 7 Izdosh Academy course-track Products so creators can promote them
 * through Sofsavdo (see src/izdosh-integration/ and src/flows/referral.controller.ts for how a
 * click on a creator's Flow link ends up on izdosh.uz and reports a 5% commission back here).
 *
 * Each Product is an external-redirect product (no Offer, never sold through Sofsavdo's own
 * checkout) — admin can still edit name/images/description afterward via the normal
 * /admin/products UI (ProductForm.tsx already supports externalRedirectUrl/externalPartner).
 * Safe to re-run: upserts by slug, so editing course prices in code and re-running just updates
 * estimatedEarningLabel rather than duplicating rows.
 *
 * Run with: npx ts-node scripts/seed-izdosh-products.ts (from apps/api).
 */
import "reflect-metadata";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const pool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 30_000 });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

// Prices mirror marketpro/supabase/seed.sql (the source of truth for Izdosh's own catalog) —
// price_start is what's shown here as the reference "starting from" figure; Izdosh's own site
// sells 3 tariffs (Start/Standard/Pro) per course, priced independently there.
const IZDOSH_COURSES = [
  {
    slug: "uzum-market",
    name: "Uzum Market",
    shortDescription: "Uzum Market'da mustaqil do'kon ochish va boshqarish.",
    description:
      "Mustaqil ravishda Uzum Market do'konini ochish va boshqarish: mahsulot tanlash, listing, birinchi buyurtmalar, target reklama.",
    priceStartSom: 1_490_000,
  },
  {
    slug: "marketplace-business",
    name: "Marketplace Business",
    shortDescription: "Bir nechta marketplace'da to'liq biznes tizimi (flagman yo'nalish).",
    description:
      "Bir nechta marketplace (Uzum, Wildberries, Yandex)da to'liq biznes tizimini qurish va boshqarish: sourcing, narxlash, logistika, AI bilan ishlash, masshtablash.",
    priceStartSom: 3_990_000,
  },
  {
    slug: "china-sourcing",
    name: "China Sourcing",
    shortDescription: "Xitoydan mustaqil mahsulot topish va zakaz berish.",
    description:
      "Xitoydan mustaqil mahsulot topish, yetkazib beruvchi bilan muzokara, zakaz berish, logistika/bojxona asoslari.",
    priceStartSom: 790_000,
  },
  {
    slug: "landing-page",
    name: "Landing Page",
    shortDescription: "AI yordamida professional landing page yaratish.",
    description:
      "AI vositalari yordamida professional landing page'ni noldan yaratish va internetga jonli chiqarish.",
    priceStartSom: 590_000,
  },
  {
    slug: "telegram-bot",
    name: "Telegram Bot",
    shortDescription: "Biznes uchun to'liq ishlaydigan Telegram bot yaratish.",
    description: "Biznes ehtiyoji uchun to'liq ishlaydigan Telegram bot yaratish va ishga tushirish.",
    priceStartSom: 690_000,
  },
  {
    slug: "vibecoding",
    name: "VibeCoding",
    shortDescription: "AI yordamida real digital mahsulot yaratish.",
    description:
      "AI yordamida real digital mahsulot yaratish: website, web app, bot, API, ma'lumotlar bazasi, deployment.",
    priceStartSom: 1_590_000,
  },
  {
    slug: "startup-mvp",
    name: "Startup MVP",
    shortDescription: "Startup g'oyasini to'liq ishlaydigan MVP darajasiga olib chiqish.",
    description: "O'z startup g'oyasini to'liq ishlaydigan, deploy qilingan MVP darajasiga olib chiqish.",
    priceStartSom: 1_990_000,
  },
] as const;

function formatSom(amount: number): string {
  return `${amount.toLocaleString("uz-UZ").replace(/,/g, " ")} so'm`;
}

async function main() {
  for (const course of IZDOSH_COURSES) {
    const slug = `izdosh-${course.slug}`;
    await prisma.product.upsert({
      where: { slug },
      update: {
        externalRedirectUrl: `https://izdosh.uz/courses/${course.slug}`,
        externalPartner: "IZDOSH",
        estimatedEarningLabel: `${formatSom(course.priceStartSom)}dan boshlab, 5%`,
      },
      create: {
        name: course.name,
        slug,
        type: "COURSE",
        shortDescription: course.shortDescription,
        description: course.description,
        status: "ACTIVE",
        images: [],
        videos: [],
        currency: "UZS",
        externalRedirectUrl: `https://izdosh.uz/courses/${course.slug}`,
        externalPartner: "IZDOSH",
        commissionType: "PERCENTAGE",
        commissionRateBps: 500, // 5% — documented here for admin display; the real per-sale
        // amount is always computed and reported by Izdosh itself (see
        // IzdoshIntegrationService.recordConversion), never re-derived from this rate.
        estimatedEarningLabel: `${formatSom(course.priceStartSom)}dan boshlab, 5%`,
      },
    });
    console.log(`Upserted ${slug}`);
  }
  console.log(`\nDone — ${IZDOSH_COURSES.length} Izdosh products ready. Add real cover images via /admin/products.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
