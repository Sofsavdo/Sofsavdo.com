// Realistic Uzbek seed data covering every entity the Phase 6 spec lists (§6). Run with
// `npm run seed --workspace=@sofsavdo/api`. Passwords below are DEVELOPMENT ONLY — see the loud
// warning at the bottom of this file; nothing here is fit for a staging/production database.
import "reflect-metadata";
import { PrismaClient, CommissionType, DiscountType, SocialPlatform, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as argon2 from "argon2";
import { createWithUniqueCode, generatePromoCode, generateReferralCode, randomSuffix } from "../src/common/codes/code-generator";
import { seedRolesAndPermissions } from "./lib/seed-roles-permissions";

const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? "postgresql://sofsavdo:sofsavdo@localhost:5432/sofsavdo" });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const DEV_PASSWORD = "Sofsavdo#2026dev";

async function seedStaffUsers() {
  const passwordHash = await argon2.hash(DEV_PASSWORD);
  const staff = [
    { email: "manager@sofsavdo.com", roleKey: "manager" as const },
    { email: "admin@sofsavdo.com", roleKey: "admin" as const },
    { email: "super@sofsavdo.com", roleKey: "super_admin" as const },
  ];

  for (const s of staff) {
    const role = await prisma.role.findUniqueOrThrow({ where: { key: s.roleKey } });
    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: { email: s.email, passwordHash, emailVerified: new Date() },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });
  }
  console.log("Seeded 3 staff accounts (manager/admin/super_admin @sofsavdo.com).");
}

// Requested test accounts (see PR description) — an admin and a creator account sharing one
// password so auth/RBAC can be manually verified in dev/staging. Email is globally unique
// (User.email @unique — see schema.prisma), so the creator account reuses the same Gmail inbox
// via a "+creator" alias (Gmail ignores everything after "+", so mail for both still lands in one
// inbox) rather than colliding with the admin account or inventing an unrelated email.
const REQUESTED_TEST_PASSWORD = "Medik9298";
const REQUESTED_ADMIN_EMAIL = "sellercloudx@gmail.com";
const REQUESTED_CREATOR_EMAIL = "sellercloudx+creator@gmail.com";

async function seedRequestedTestAccounts() {
  const passwordHash = await argon2.hash(REQUESTED_TEST_PASSWORD);

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { key: "admin" } });
  const adminUser = await prisma.user.upsert({
    where: { email: REQUESTED_ADMIN_EMAIL },
    update: { passwordHash },
    create: { email: REQUESTED_ADMIN_EMAIL, passwordHash, emailVerified: new Date(), status: "ACTIVE" },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
    update: {},
    create: { userId: adminUser.id, roleId: adminRole.id },
  });

  // Creators aren't gated by the Role/UserRole RBAC tables (see CreatorProfile comment above) —
  // having a CreatorProfile row is itself what makes an account a "creator" throughout the app
  // (see AuthService.getSessionSummary's creatorId field), so no Role assignment is needed here.
  const creatorUser = await prisma.user.upsert({
    where: { email: REQUESTED_CREATOR_EMAIL },
    update: { passwordHash },
    create: { email: REQUESTED_CREATOR_EMAIL, passwordHash, emailVerified: new Date(), status: "ACTIVE" },
  });
  await prisma.creatorProfile.upsert({
    where: { userId: creatorUser.id },
    update: {},
    create: {
      userId: creatorUser.id,
      displayName: "Sellercloudx Creator",
      contentNiches: [],
      referralCode: randomSuffix(8),
    },
  });

  console.log(
    `Seeded requested test accounts: admin=${REQUESTED_ADMIN_EMAIL}, creator=${REQUESTED_CREATOR_EMAIL} ` +
      `(shared password: ${REQUESTED_TEST_PASSWORD}).`,
  );
}

const CREATOR_SEED = [
  { email: "malika.yusupova@example.uz", displayName: "Malika Yusupova", city: "Toshkent", niches: ["beauty", "lifestyle"], status: "APPROVED" as const },
  { email: "aziz.karimov@example.uz", displayName: "Aziz Karimov", city: "Samarqand", niches: ["tech", "edtech"], status: "APPROVED" as const },
  { email: "dilnoza.rashidova@example.uz", displayName: "Dilnoza Rashidova", city: "Buxoro", niches: ["fashion"], status: "SUBMITTED" as const },
  { email: "sherzod.tojiyev@example.uz", displayName: "Sherzod Tojiyev", city: "Andijon", niches: ["fitness"], status: "REJECTED" as const },
];

async function seedCreators() {
  const passwordHash = await argon2.hash(DEV_PASSWORD);
  const creators: { id: string; email: string; status: string; displayName: string }[] = [];

  for (const c of CREATOR_SEED) {
    const user = await prisma.user.upsert({
      where: { email: c.email },
      update: {},
      create: { email: c.email, passwordHash, emailVerified: new Date() },
    });
    const profile = await prisma.creatorProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        displayName: c.displayName,
        city: c.city,
        contentNiches: c.niches,
        referralCode: randomSuffix(8),
      },
    });
    await prisma.socialAccount.upsert({
      where: { id: `${profile.id}-instagram-seed` },
      update: {},
      create: {
        id: `${profile.id}-instagram-seed`,
        creatorId: profile.id,
        platform: SocialPlatform.INSTAGRAM,
        handle: `@${c.displayName.toLowerCase().replace(/\s+/g, "_")}`,
        profileUrl: `https://instagram.com/${c.displayName.toLowerCase().replace(/\s+/g, "_")}`,
        followerCount: 5000 + Math.floor(Math.random() * 90_000),
      },
    });

    await prisma.creatorApplication.upsert({
      where: { id: `${profile.id}-application-seed` },
      update: { status: c.status },
      create: {
        id: `${profile.id}-application-seed`,
        creatorId: profile.id,
        status: c.status,
        currentStep: 4,
        formData: { audience: "18-34, ayollar ko'p", experience: "2 yil content yaratish" },
        submittedAt: new Date(),
        reviewedAt: c.status === "SUBMITTED" ? null : new Date(),
        reviewNote: c.status === "REJECTED" ? "Auditoriya statistikasi yetarli emas." : null,
      },
    });

    creators.push({ id: profile.id, email: c.email, status: c.status, displayName: c.displayName });
  }
  console.log(`Seeded ${creators.length} creator accounts with mixed application statuses.`);
  return creators;
}

async function seedCatalog() {
  const product = await prisma.product.upsert({
    where: { slug: "glow-serum-30ml" },
    update: {},
    create: {
      name: "Glow C-Serum 30ml",
      slug: "glow-serum-30ml",
      type: "PHYSICAL_PRODUCT",
      shortDescription: "Vitamin C asosidagi tozalovchi serum",
      description: "Yuz terisini yorqinlashtiruvchi, kunlik parvarish uchun serum.",
      brand: "Sofsavdo Beauty",
      sku: "SB-SERUM-30",
      status: "ACTIVE",
      images: ["/seed/serum-1.jpg", "/seed/serum-2.jpg"],
      currency: "UZS",
    },
  });

  const offerFields = {
    productId: product.id,
    name: "Glow C-Serum — 30 kunlik parvarish",
    slug: "glow-serum",
    offerType: "ONE_TIME" as const,
    headline: "Terangizga 14 kunda porloqlik qaytadi",
    subheadline: "Vitamin C, hyaluron kislota va niacinamid — bir shishada.",
    priceMinor: 24_900_00,
    compareAtPriceMinor: 34_900_00,
    currency: "UZS",
    paymentOptions: ["CLICK", "PAYME", "CARD", "COD", "PAY_LATER"],
    ctaType: "BUY_NOW" as const,
    ctaLabel: "Hozir buyurtma bering",
    status: "ACTIVE" as const,
  };
  // `update` re-applies every field on a re-seed — an upsert with an empty `update: {}` silently
  // skips changes to an already-existing row (a real gap found while adding Phase 8's
  // paymentOptions/ctaLabel to this seed), leaving old data in place across reseeds.
  const offer = await prisma.offer.upsert({
    where: { slug: "glow-serum" },
    update: offerFields,
    create: offerFields,
  });

  await prisma.offerVariant.upsert({
    where: { id: `${offer.id}-standard` },
    update: {},
    create: { id: `${offer.id}-standard`, offerId: offer.id, name: "1 dona", priceMinor: 24_900_00, isDefault: true, sortOrder: 0 },
  });

  // PUBLISHED — checkout (Phase 8) requires a live landing to accept orders; the seeded catalog is
  // meant to be immediately checkout-able, not a draft an admin still has to publish by hand.
  const landing = await prisma.landingPage.upsert({
    where: { offerId: offer.id },
    update: { status: "PUBLISHED", publishedAt: new Date() },
    create: { offerId: offer.id, status: "PUBLISHED", publishedAt: new Date() },
  });

  // Delivery region (Phase 8) — the seeded product is PHYSICAL_PRODUCT, so checkout requires at
  // least one region to compute the delivery fee (see DeliveryService.resolveDeliveryFee).
  await prisma.offerDeliveryRegion.upsert({
    where: { offerId_regionCode: { offerId: offer.id, regionCode: "TAS" } },
    update: {},
    create: {
      offerId: offer.id,
      regionCode: "TAS",
      regionName: "Toshkent",
      feeType: "FREE",
      deliveryFeeMinor: 0,
      availability: "AVAILABLE",
      active: true,
      estimatedMinDays: 1,
      estimatedMaxDays: 2,
    },
  });

  const sections: { type: "HERO" | "BENEFITS" | "FAQ" | "FINAL_CTA"; sortOrder: number; content: Record<string, unknown> }[] = [
    { type: "HERO", sortOrder: 0, content: { headline: offer.headline, subheadline: offer.subheadline, image: "/seed/serum-1.jpg" } },
    { type: "BENEFITS", sortOrder: 1, content: { items: ["14 kunda natija", "Barcha teri turlariga mos", "Dermatologlar tomonidan sinovdan o'tgan"] } },
    { type: "FAQ", sortOrder: 2, content: { items: [{ q: "Yetkazib berish qancha vaqt oladi?", a: "Toshkent bo'yicha 1-2 kun, viloyatlarga 3-5 kun." }] } },
    { type: "FINAL_CTA", sortOrder: 3, content: { label: "Hozir buyurtma bering" } },
  ];
  for (const s of sections) {
    await prisma.landingSection.upsert({
      where: { id: `${landing.id}-${s.type}` },
      update: {},
      create: { id: `${landing.id}-${s.type}`, landingPageId: landing.id, type: s.type, sortOrder: s.sortOrder, content: s.content as Prisma.InputJsonValue },
    });
  }

  return { product, offer };
}

async function seedCampaign(offerId: string, creators: { id: string; status: string; displayName: string }[]) {
  const campaign = await prisma.campaign.upsert({
    where: { slug: "glow-serum-launch" },
    update: {},
    create: {
      offerId,
      name: "Glow Serum — yoz start kampaniyasi",
      slug: "glow-serum-launch",
      description: "Yozgi teri parvarishi mavzusida content yaratish kampaniyasi.",
      category: "beauty",
      ctaLabel: "Kampaniyaga qo'shilish",
      goal: "500 ta sotuv",
      platforms: [SocialPlatform.INSTAGRAM, SocialPlatform.TIKTOK],
      contentFormats: ["reels", "story"],
      requiredElements: ["mahsulotni ishlatish jarayoni ko'rsatilishi"],
      forbiddenElements: ["tibbiy da'volar"],
      creatorLimit: 20,
      requiresApproval: true,
      commissionType: CommissionType.PERCENTAGE,
      commissionRateBps: 2000,
      customerDiscountType: DiscountType.PERCENTAGE,
      customerDiscountValue: 1000,
      attributionWindowDays: 30,
      status: "ACTIVE",
    },
  });

  const approved = creators.filter((c) => c.status === "APPROVED");
  for (const creator of approved) {
    await prisma.campaignApplication.upsert({
      where: { campaignId_creatorId: { campaignId: campaign.id, creatorId: creator.id } },
      update: { status: "APPROVED" },
      create: { campaignId: campaign.id, creatorId: creator.id, status: "APPROVED", reviewedAt: new Date() },
    });
    await prisma.creatorCampaign.upsert({
      where: { campaignId_creatorId: { campaignId: campaign.id, creatorId: creator.id } },
      update: {},
      create: { campaignId: campaign.id, creatorId: creator.id, status: "ACTIVE" },
    });

    // Human-readable, non-deterministic, retry-on-collision codes (see
    // src/common/codes/code-generator.ts) — NOT derived from slicing creator.id. An earlier
    // version of this seed sliced the front of creator.id for the promo code, which reliably
    // collided (cuid()'s leading characters encode a shared timestamp for ids minted in the same
    // process/millisecond) and crashed the very first real-database seed run with a P2002.
    const promo = await createWithUniqueCode(
      () => generatePromoCode(creator.displayName, campaign.name),
      (code) =>
        prisma.promoCode.upsert({
          where: { creatorId_campaignId: { creatorId: creator.id, campaignId: campaign.id } },
          update: {},
          create: {
            code,
            creatorId: creator.id,
            campaignId: campaign.id,
            offerId,
            discountType: DiscountType.PERCENTAGE,
            discountValue: 1000,
            usageLimit: 200,
          },
        }),
    );
    await createWithUniqueCode(
      () => generateReferralCode(creator.displayName, campaign.name),
      (code) =>
        prisma.referralLink.upsert({
          where: { creatorId_campaignId: { creatorId: creator.id, campaignId: campaign.id } },
          update: {},
          create: {
            code,
            creatorId: creator.id,
            campaignId: campaign.id,
            offerId,
            promoCodeId: promo.id,
            attributionWindowDays: 30,
          },
        }),
    );
  }
  console.log(`Seeded 1 campaign with ${approved.length} approved creators, referral links, and promo codes.`);
  return campaign;
}

// Every entity this seed touches is upserted on a stable, deterministic key (an email, a slug, or
// a synthetic id derived from a parent row's id) — running this script a second time updates
// those same rows in place rather than crashing on a unique-constraint violation or duplicating
// data. There is no separate "reset" step required for a second run to be safe; `db:reset` exists
// only for when a developer explicitly wants to wipe and start over.
async function printSummary() {
  // Sequential, not Promise.all: this codebase's test Postgres sits behind a proxy (Railway) that
  // has been observed dropping connections under concurrent pooled queries (P1017 "Server has
  // closed the connection", reproduced during Phase 6A verification). Ten counts run one after
  // another cost a fraction of a second more than running them concurrently and are not on any
  // user-facing request path — reliability against a flaky proxy is worth more here than the
  // saved latency.
  const userCount = await prisma.user.count();
  const roleCount = await prisma.role.count();
  const permissionCount = await prisma.permission.count();
  const rolePermissionCount = await prisma.rolePermission.count();
  const creatorCount = await prisma.creatorProfile.count();
  const productCount = await prisma.product.count();
  const offerCount = await prisma.offer.count();
  const campaignCount = await prisma.campaign.count();
  const referralLinkCount = await prisma.referralLink.count();
  const promoCodeCount = await prisma.promoCode.count();

  console.log("\n=== SEED SUMMARY (current database totals, not just this run's inserts) ===");
  console.log(`Users:            ${userCount}`);
  console.log(`Roles:            ${roleCount}`);
  console.log(`Permissions:      ${permissionCount}`);
  console.log(`Role-permissions: ${rolePermissionCount}`);
  console.log(`Creators:         ${creatorCount}`);
  console.log(`Products:         ${productCount}`);
  console.log(`Offers:           ${offerCount}`);
  console.log(`Campaigns:        ${campaignCount}`);
  console.log(`Referral links:   ${referralLinkCount}`);
  console.log(`Promo codes:      ${promoCodeCount}`);
}

async function main() {
  // Phase 14 hard guard: this script seeds demo creators/campaigns/promo codes and gives every
  // account the same publicly-known DEV_PASSWORD — never something a production database should
  // ever run, accidentally or otherwise. There is no override flag by design; production's first
  // super admin must go through a dedicated one-time bootstrap procedure instead (see RUNBOOK.md).
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Refusing to run prisma/seed.ts against a production environment (NODE_ENV=production). " +
        "This script creates demo accounts that all share one publicly-known password and is for " +
        "local/staging development only. See RUNBOOK.md for the production super-admin bootstrap procedure.",
    );
  }

  await seedRolesAndPermissions(prisma);
  await seedStaffUsers();
  await seedRequestedTestAccounts();
  const creators = await seedCreators();
  const { offer } = await seedCatalog();
  await seedCampaign(offer.id, creators);
  await printSummary();

  console.log("\n=== DEVELOPMENT SEED COMPLETE ===");
  console.log(`All seeded accounts share password: ${DEV_PASSWORD}`);
  console.log("THESE CREDENTIALS ARE FOR LOCAL DEVELOPMENT ONLY — never reuse in staging/production.");
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
