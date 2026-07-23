import type {
  Campaign,
  Commission,
  CreatorCampaign,
  CreatorContent,
  CreatorUser,
  OrderStatus,
  Payout,
  PayoutMethod,
  Sale,
} from "@rosti/types";

// Realistic Uzbek seed data for the Phase 3 mock service layer. Every demo account below can be
// used to log in (see lib/api/auth.ts) and exercises a different CreatorApplicationStatus so the
// UI's role/state gating (onboarding vs. dashboard vs. rejection screen) can actually be checked
// by hand, not just read about.

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

export const CAMPAIGNS: Campaign[] = [
  {
    id: "camp_serum",
    offerId: "offer_serum",
    slug: "glowup-vitamin-c-serum",
    name: "GlowUp Vitamin C Serum — ilgor reklama",
    coverImage: "serum",
    category: "Go'zallik",
    offer: {
      id: "offer_serum",
      name: "GlowUp Vitamin C Serum",
      slug: "glowup-serum",
      productType: "PHYSICAL_PRODUCT",
      priceMinor: 18_900_00,
      compareAtPriceMinor: 24_900_00,
      currency: "UZS",
    },
    description:
      "Yuzni yorug'lantiruvchi va qorong'u dog'larni kamaytiruvchi vitamin C serum. Auditoriyangizga 30 kunlik natija bilan tanishtiring.",
    goal: "Instagram va TikTok orqali savdo hajmini oshirish",
    targetAudience: "18–35 yosh, go'zallik va parvarish mavzusiga qiziquvchi ayollar",
    platforms: ["INSTAGRAM", "TIKTOK"],
    contentFormats: ["Reels", "Unboxing video", "Before/After story"],
    requiredElements: ["Mahsulotni yuzda qo'llash jarayoni", "Promo kodni ovozli aytish"],
    forbiddenElements: ["Tibbiy davolash da'volari", "\"100% kafolat\" so'zini ishlatish"],
    ctaLabel: "Hozir buyurtma bering",
    commissionType: "PERCENTAGE",
    commissionRateBps: 2000,
    customerDiscountType: "PERCENTAGE",
    customerDiscountValue: 1000,
    barterEnabled: true,
    freeProduct: "1 dona serum sovg'a",
    applicationDeadline: daysFromNow(12),
    creatorLimit: 25,
    approvedCreatorCount: 18,
    status: "ACTIVE",
    requiresApproval: true,
    attributionWindowDays: 30,
    assets: [
      { id: "a1", kind: "brief", label: "Kampaniya brifi (PDF)" },
      { id: "a2", kind: "image", label: "Mahsulot fotolari (8 ta)" },
      { id: "a3", kind: "caption_template", label: "Tayyor caption shablonlari" },
    ],
  },
  {
    id: "camp_marketplace_course",
    offerId: "offer_marketplace",
    slug: "marketplace-savdo-kursi",
    name: "Marketplace'da Savdo kursi",
    coverImage: "course_marketplace",
    category: "Ta'lim",
    offer: {
      id: "offer_marketplace",
      name: "Marketplace'da Savdo — to'liq kurs",
      slug: "marketplace-kursi",
      productType: "COURSE",
      priceMinor: 2_990_000_00,
      currency: "UZS",
    },
    description:
      "Uzum Market va Yandex Market'da noldan savdo boshlash bo'yicha 6 haftalik video kurs, amaliy uy vazifalari bilan.",
    goal: "YouTube va Telegram orqali kursga ro'yxatdan o'tishni ko'paytirish",
    targetAudience: "20–40 yosh, o'z biznesini boshlashni xohlovchi tadbirkorlar",
    platforms: ["YOUTUBE", "TELEGRAM"],
    contentFormats: ["Sharh video (10+ daqiqa)", "Telegram post"],
    requiredElements: ["Kursning 3 ta asosiy modulini sanab o'tish", "Muallif bilan intervyu qisqacha eslatilishi"],
    forbiddenElements: ["\"Bir kunda boy bo'lasiz\" kabi da'volar"],
    ctaLabel: "Kursga yozilish",
    commissionType: "PERCENTAGE",
    commissionRateBps: 2000,
    barterEnabled: false,
    applicationDeadline: daysFromNow(20),
    creatorLimit: 15,
    approvedCreatorCount: 9,
    status: "ACTIVE",
    requiresApproval: true,
    attributionWindowDays: 45,
    assets: [
      { id: "a4", kind: "brief", label: "Kampaniya brifi (PDF)" },
      { id: "a5", kind: "video", label: "Kurs dasturi videosi" },
    ],
  },
  {
    id: "camp_ai_course",
    offerId: "offer_ai",
    slug: "ai-vibe-coding-kursi",
    name: "AI va Vibe Coding kursi",
    coverImage: "course_ai",
    category: "Ta'lim",
    offer: {
      id: "offer_ai",
      name: "AI va Vibe Coding — Premium tarif",
      slug: "ai-vibe-coding-premium",
      productType: "COURSE",
      priceMinor: 3_490_000_00,
      currency: "UZS",
    },
    description: "Claude va boshqa AI vositalari yordamida dastur yozishni o'rgatuvchi amaliy kurs.",
    goal: "Telegram va YouTube orqali IT auditoriyasini jalb qilish",
    targetAudience: "18–30 yosh, dasturlashga qiziquvchilar",
    platforms: ["TELEGRAM", "YOUTUBE"],
    contentFormats: ["Demo video", "Ekran yozuvi (screen recording)"],
    requiredElements: ["Kursda qurilgan real loyihani ko'rsatish"],
    forbiddenElements: ["Boshqa kurslarni kamsitish"],
    ctaLabel: "Premium tarifga yozilish",
    commissionType: "PERCENTAGE",
    commissionRateBps: 1500,
    barterEnabled: false,
    applicationDeadline: daysFromNow(25),
    creatorLimit: 10,
    approvedCreatorCount: 4,
    status: "ACTIVE",
    requiresApproval: true,
    attributionWindowDays: 30,
    assets: [{ id: "a6", kind: "brief", label: "Kampaniya brifi (PDF)" }],
  },
  {
    id: "camp_mvp_service",
    offerId: "offer_mvp",
    slug: "startup-mvp-xizmati",
    name: "Startup MVP yaratish xizmati",
    coverImage: "service_mvp",
    category: "Xizmat",
    offer: {
      id: "offer_mvp",
      name: "Startup MVP — 4 haftada",
      slug: "startup-mvp",
      productType: "SERVICE",
      priceMinor: 12_000_000_00,
      currency: "UZS",
    },
    description: "Startaplar uchun 4 haftada ishlaydigan MVP yaratib beruvchi xizmat.",
    goal: "Telegram orqali startap asoschilaridan ariza yig'ish",
    targetAudience: "Startap asoschilari, kichik biznes egalari",
    platforms: ["TELEGRAM"],
    contentFormats: ["Case-study post", "Suhbat formatidagi video"],
    requiredElements: ["Ariza qoldirish havolasini aniq ko'rsatish"],
    forbiddenElements: ["Aniq muddatni o'zgartirib ko'rsatish"],
    ctaLabel: "Bepul konsultatsiyaga yozilish",
    commissionType: "FIXED_AMOUNT",
    commissionAmountMinor: 800_000_00,
    barterEnabled: false,
    applicationDeadline: daysFromNow(30),
    creatorLimit: 8,
    approvedCreatorCount: 2,
    status: "ACTIVE",
    requiresApproval: true,
    attributionWindowDays: 60,
    assets: [{ id: "a7", kind: "brief", label: "Xizmat tavsifi (PDF)" }],
  },
  {
    id: "camp_ecohome",
    offerId: "offer_ecohome",
    slug: "ecohome-idish-tovoq",
    name: "EcoHome Idish-tovoq to'plami",
    coverImage: "ecohome",
    category: "Uy-ro'zg'or",
    offer: {
      id: "offer_ecohome",
      name: "EcoHome 12 buyumli to'plam",
      slug: "ecohome-set",
      productType: "PHYSICAL_PRODUCT",
      priceMinor: 890_000_00,
      compareAtPriceMinor: 1_190_000_00,
      currency: "UZS",
    },
    description: "Ekologik toza materialdan tayyorlangan oshxona buyumlari to'plami.",
    goal: "Instagram orqali uy-ro'zg'or auditoriyasiga yetib borish",
    targetAudience: "25–45 yosh, uy bekalari",
    platforms: ["INSTAGRAM"],
    contentFormats: ["Reels", "Karusel post"],
    requiredElements: ["To'plam tarkibidagi buyumlarni sanab o'tish"],
    forbiddenElements: [],
    ctaLabel: "Chegirma bilan xarid qilish",
    commissionType: "PERCENTAGE",
    commissionRateBps: 1500,
    customerDiscountType: "FIXED_AMOUNT",
    customerDiscountValue: 50_000_00,
    barterEnabled: true,
    freeProduct: "To'plamning o'zi barter sifatida",
    applicationDeadline: daysFromNow(8),
    creatorLimit: 20,
    approvedCreatorCount: 20,
    status: "PAUSED",
    requiresApproval: false,
    attributionWindowDays: 30,
    assets: [{ id: "a8", kind: "image", label: "Mahsulot fotolari" }],
  },
  {
    id: "camp_english_course",
    offerId: "offer_english",
    slug: "onlayn-ingliz-tili-kursi",
    name: "Onlayn Ingliz tili kursi",
    coverImage: "course_english",
    category: "Ta'lim",
    offer: {
      id: "offer_english",
      name: "Ingliz tili — Boshlang'ich daraja",
      slug: "ingliz-tili-boshlangich",
      productType: "COURSE",
      priceMinor: 990_000_00,
      currency: "UZS",
    },
    description: "0 dan boshlab ingliz tilini o'rgatuvchi 3 oylik onlayn kurs.",
    goal: "TikTok orqali yosh auditoriyaga yetib borish",
    targetAudience: "16–25 yosh, til o'rganishni xohlovchilar",
    platforms: ["TIKTOK", "TELEGRAM"],
    contentFormats: ["Qisqa video-dars namunasi", "Duet/Stitch format"],
    requiredElements: ["Bepul sinov darsi havolasini ko'rsatish"],
    forbiddenElements: [],
    ctaLabel: "Bepul sinov darsiga yozilish",
    commissionType: "FIXED_AMOUNT",
    commissionAmountMinor: 150_000_00,
    barterEnabled: false,
    applicationDeadline: daysFromNow(15),
    creatorLimit: 30,
    approvedCreatorCount: 22,
    status: "ACTIVE",
    requiresApproval: false,
    attributionWindowDays: 30,
    assets: [{ id: "a9", kind: "video", label: "Namuna dars videosi" }],
  },
];

function campaign(id: string): Campaign {
  const found = CAMPAIGNS.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown seed campaign id: ${id}`);
  return found;
}

export const MALIKA_CREATOR_CAMPAIGNS: CreatorCampaign[] = [
  {
    id: "cc_active_serum",
    campaignId: "camp_serum",
    campaign: campaign("camp_serum"),
    status: "ACTIVE",
    joinedAt: daysAgo(21),
    referralLink: {
      code: "malika-serum",
      fullUrl: "https://rosti.uz/o/glowup-serum?ref=malika-serum",
      shortUrl: "https://rosti.uz/r/malika-serum",
      clicks: 842,
      createdAt: daysAgo(21),
    },
    promoCode: { code: "MALIKA10", discountType: "PERCENTAGE", discountValue: 1000, usageCount: 47 },
  },
  {
    id: "cc_active_english",
    campaignId: "camp_english_course",
    campaign: campaign("camp_english_course"),
    status: "ACTIVE",
    joinedAt: daysAgo(9),
    referralLink: {
      code: "malika-english",
      fullUrl: "https://rosti.uz/o/ingliz-tili-boshlangich?ref=malika-english",
      shortUrl: "https://rosti.uz/r/malika-english",
      clicks: 210,
      createdAt: daysAgo(9),
    },
    promoCode: { code: "MALIKAENG", discountType: "PERCENTAGE", discountValue: 0, usageCount: 12 },
  },
  {
    id: "cc_content_review",
    campaignId: "camp_marketplace_course",
    campaign: campaign("camp_marketplace_course"),
    status: "CONTENT_REVIEW",
    joinedAt: daysAgo(6),
  },
  {
    id: "cc_content_required",
    campaignId: "camp_ai_course",
    campaign: campaign("camp_ai_course"),
    status: "CONTENT_REQUIRED",
    joinedAt: daysAgo(4),
  },
  {
    id: "cc_shipped",
    campaignId: "camp_ecohome",
    campaign: campaign("camp_ecohome"),
    status: "SHIPPED",
    joinedAt: daysAgo(10),
  },
  {
    id: "cc_preparing",
    campaignId: "camp_ecohome",
    campaign: campaign("camp_ecohome"),
    status: "PRODUCT_PREPARING",
    joinedAt: daysAgo(3),
  },
  {
    id: "cc_under_review",
    campaignId: "camp_mvp_service",
    campaign: campaign("camp_mvp_service"),
    status: "UNDER_REVIEW",
    joinedAt: daysAgo(1),
  },
  {
    id: "cc_applied",
    campaignId: "camp_mvp_service",
    campaign: campaign("camp_mvp_service"),
    status: "APPLIED",
    joinedAt: daysAgo(0),
  },
  {
    id: "cc_completed",
    campaignId: "camp_english_course",
    campaign: campaign("camp_english_course"),
    status: "COMPLETED",
    joinedAt: daysAgo(60),
  },
  {
    id: "cc_rejected",
    campaignId: "camp_ai_course",
    campaign: campaign("camp_ai_course"),
    status: "REJECTED",
    joinedAt: daysAgo(15),
    rejectionReason:
      "So'nggi 30 kunlik auditoriya statistikasi kampaniya uchun belgilangan minimal ko'rsatkichga to'g'ri kelmadi.",
  },
  {
    id: "cc_cancelled",
    campaignId: "camp_ecohome",
    campaign: campaign("camp_ecohome"),
    status: "CANCELLED",
    joinedAt: daysAgo(40),
  },
];

export const MALIKA_CONTENT: CreatorContent[] = [
  {
    id: "content_1",
    creatorCampaignId: "cc_active_serum",
    campaignName: "GlowUp Vitamin C Serum",
    status: "PUBLISHED",
    caption: "30 kunda terim butunlay o'zgardi! Promo kod: MALIKA10 😍 #GlowUp #RostiCreator",
    platform: "INSTAGRAM",
    publishedUrl: "https://instagram.com/reel/example1",
    draftFileNames: ["serum_reels_final.mp4"],
    history: [
      { status: "SUBMITTED", at: daysAgo(20) },
      { status: "APPROVED", at: daysAgo(19) },
      { status: "PUBLISHED", at: daysAgo(18) },
    ],
    submittedAt: daysAgo(20),
    updatedAt: daysAgo(18),
  },
  {
    id: "content_2",
    creatorCampaignId: "cc_content_review",
    campaignName: "Marketplace'da Savdo kursi",
    status: "UNDER_REVIEW",
    caption: "Uzum Market'da noldan qanday boshlash kerak — to'liq sharh 👇",
    platform: "YOUTUBE",
    draftFileNames: ["marketplace_sharh_draft.mp4"],
    history: [{ status: "SUBMITTED", at: daysAgo(2) }],
    submittedAt: daysAgo(2),
    updatedAt: daysAgo(2),
  },
  {
    id: "content_3",
    creatorCampaignId: "cc_content_required",
    campaignName: "AI va Vibe Coding kursi",
    status: "DRAFT",
    draftFileNames: [],
    history: [],
    updatedAt: daysAgo(4),
  },
  {
    id: "content_4",
    creatorCampaignId: "cc_active_english",
    campaignName: "Onlayn Ingliz tili kursi",
    status: "REVISION_REQUESTED",
    caption: "Ingliz tilini 3 oyda o'rganish sirlari",
    platform: "TIKTOK",
    draftFileNames: ["ingliz_video_v1.mp4"],
    reviewNote:
      "Videoning boshida bepul sinov darsi havolasi aniq ko'rsatilmagan — iltimos, birinchi 5 soniyada CTA'ni qo'shing.",
    history: [
      { status: "SUBMITTED", at: daysAgo(5) },
      { status: "REVISION_REQUESTED", note: "CTA yetishmayapti", at: daysAgo(4) },
    ],
    submittedAt: daysAgo(5),
    updatedAt: daysAgo(4),
  },
];

const MASKED_CUSTOMERS = [
  "M. Aliyeva, +998 90 *** ** 12",
  "D. Ergasheva, +998 93 *** ** 47",
  "S. Yusupov, +998 99 *** ** 08",
  "N. Qodirova, +998 91 *** ** 63",
  "J. Rahimov, +998 97 *** ** 29",
];

const salesRaw: Array<[string, string, number, number, "PROMO_CODE" | "REFERRAL_VISIT", OrderStatusLite]> = [
  ["GlowUp Vitamin C Serum", "GlowUp Vitamin C Serum", 18_900_00, 1_890_00, "PROMO_CODE", "DELIVERED"],
  ["GlowUp Vitamin C Serum", "GlowUp Vitamin C Serum", 18_900_00, 1_890_00, "PROMO_CODE", "DELIVERED"],
  ["GlowUp Vitamin C Serum", "GlowUp Vitamin C Serum", 17_010_00, 1_701_00, "REFERRAL_VISIT", "SHIPPED"],
  ["GlowUp Vitamin C Serum", "GlowUp Vitamin C Serum", 18_900_00, 1_890_00, "PROMO_CODE", "PROCESSING"],
  ["GlowUp Vitamin C Serum", "GlowUp Vitamin C Serum", 18_900_00, 1_890_00, "PROMO_CODE", "CANCELLED"],
  ["Onlayn Ingliz tili kursi", "Ingliz tili — Boshlang'ich daraja", 990_000_00, 150_000_00, "PROMO_CODE", "COMPLETED"],
  ["Onlayn Ingliz tili kursi", "Ingliz tili — Boshlang'ich daraja", 990_000_00, 150_000_00, "REFERRAL_VISIT", "COMPLETED"],
  ["Onlayn Ingliz tili kursi", "Ingliz tili — Boshlang'ich daraja", 990_000_00, 150_000_00, "PROMO_CODE", "REFUNDED"],
];

type OrderStatusLite = "DELIVERED" | "SHIPPED" | "PROCESSING" | "CANCELLED" | "COMPLETED" | "REFUNDED";

export const MALIKA_SALES: Sale[] = salesRaw.map(
  ([campaignName, offerName, amountMinor, commissionMinor, source, orderStatus], i) => ({
    id: `sale_${i + 1}`,
    orderPublicToken: `ord_${1000 + i}`,
    createdAt: daysAgo(25 - i * 3),
    campaignName,
    offerName,
    customerMasked: MASKED_CUSTOMERS[i % MASKED_CUSTOMERS.length]!,
    amountMinor,
    discountMinor: Math.round(amountMinor * 0.1),
    commissionBaseMinor: amountMinor - Math.round(amountMinor * 0.1),
    commissionMinor,
    orderStatus,
    attributionSource: source,
  }),
);

export const MALIKA_COMMISSIONS: Commission[] = MALIKA_SALES.map((s, i) => ({
  id: `commission_${i + 1}`,
  saleId: s.id,
  campaignName: s.campaignName,
  baseAmountMinor: s.commissionBaseMinor,
  amountMinor: s.commissionMinor,
  status: commissionStatusFor(s.orderStatus),
  createdAt: s.createdAt,
  payableAt: ["DELIVERED", "COMPLETED"].includes(s.orderStatus) ? daysAgo(2) : undefined,
  paidAt: i === 5 ? daysAgo(1) : undefined,
}));

function commissionStatusFor(orderStatus: OrderStatus): Commission["status"] {
  switch (orderStatus) {
    case "CANCELLED":
      return "REJECTED";
    case "REFUNDED":
      return "REFUNDED";
    case "PROCESSING":
    case "SHIPPED":
      return "PENDING";
    case "DELIVERED":
      return "APPROVED";
    case "COMPLETED":
      return "PAID";
    default:
      return "PENDING";
  }
}

export const MALIKA_PAYOUT_METHODS: PayoutMethod[] = [
  { id: "pm_1", type: "CARD", label: "Uzcard •••• 4521 — Malika Yusupova", isDefault: true },
];

export const MALIKA_PAYOUTS: Payout[] = [
  {
    id: "payout_1",
    amountMinor: 450_000_00,
    status: "PAID",
    payoutMethodLabel: "Uzcard •••• 4521",
    requestedAt: daysAgo(30),
    paidAt: daysAgo(28),
  },
  {
    id: "payout_2",
    amountMinor: 150_000_00,
    status: "UNDER_REVIEW",
    payoutMethodLabel: "Uzcard •••• 4521",
    requestedAt: daysAgo(1),
  },
];

export const CREATORS: Record<string, CreatorUser> = {
  "malika@example.uz": {
    id: "user_malika",
    email: "malika@example.uz",
    displayName: "Malika Yusupova",
    avatarInitials: "MY",
    application: {
      id: "app_malika",
      status: "APPROVED",
      currentStep: 8,
      data: {
        fullName: "Malika Yusupova",
        phone: "+998 90 123 45 67",
        city: "Toshkent",
        bio: "Go'zallik va turmush tarzi bo'yicha kontent yarataman.",
        socialAccounts: [
          { id: "sa1", platform: "INSTAGRAM", handle: "@malika.beauty", profileUrl: "https://instagram.com/malika.beauty", followerCount: 84_000 },
          { id: "sa2", platform: "TIKTOK", handle: "@malika.beauty", profileUrl: "https://tiktok.com/@malika.beauty", followerCount: 132_000 },
        ],
        contentNiches: ["Go'zallik", "Turmush tarzi"],
        audienceAgeRange: "18–34",
        audienceGeography: "O'zbekiston, asosan Toshkent",
        audienceInterests: "Parvarish, moda, sog'lom turmush tarzi",
        priorExperience: "2 yildan beri turli brendlar bilan hamkorlik qilaman.",
        payoutMethodType: "CARD",
        payoutCardNumber: "8600 **** **** 4521",
        payoutCardHolder: "MALIKA YUSUPOVA",
        termsAccepted: true,
      },
      submittedAt: daysAgo(40),
      reviewedAt: daysAgo(38),
    },
  },
  "aziz@example.uz": {
    id: "user_aziz",
    email: "aziz@example.uz",
    displayName: "Aziz Karimov",
    avatarInitials: "AK",
    application: {
      id: "app_aziz",
      status: "SUBMITTED",
      currentStep: 8,
      data: {
        fullName: "Aziz Karimov",
        phone: "+998 93 456 78 90",
        city: "Samarqand",
        bio: "Texnologiya va gadjetlar haqida video yarataman.",
        socialAccounts: [
          { id: "sa3", platform: "YOUTUBE", handle: "Aziz Tech", profileUrl: "https://youtube.com/@aziztech", followerCount: 45_000 },
        ],
        contentNiches: ["Texnologiya"],
        audienceAgeRange: "18–30",
        audienceGeography: "O'zbekiston",
        audienceInterests: "Gadjetlar, IT",
        priorExperience: "Bir nechta mahalliy brendlar bilan ishlaganman.",
        payoutMethodType: "CARD",
        payoutCardNumber: "9860 **** **** 1187",
        payoutCardHolder: "AZIZ KARIMOV",
        termsAccepted: true,
      },
      submittedAt: daysAgo(2),
    },
  },
  "dilnoza@example.uz": {
    id: "user_dilnoza",
    email: "dilnoza@example.uz",
    displayName: "Dilnoza Rashidova",
    avatarInitials: "DR",
    application: {
      id: "app_dilnoza",
      status: "REVISION_REQUESTED",
      currentStep: 7,
      data: {
        fullName: "Dilnoza Rashidova",
        phone: "+998 97 111 22 33",
        city: "Farg'ona",
        bio: "Ona va bola mavzusida kontent yarataman.",
        socialAccounts: [
          { id: "sa4", platform: "INSTAGRAM", handle: "@dilnoza.mama", profileUrl: "https://instagram.com/dilnoza.mama", followerCount: 21_000 },
        ],
        contentNiches: ["Ona va bola"],
        audienceAgeRange: "22–38",
        audienceGeography: "Farg'ona vodiysi",
        audienceInterests: "Bolalar tarbiyasi, uy xo'jaligi",
        priorExperience: "Hozircha rasmiy hamkorlik tajribam yo'q.",
      },
      reviewNote:
        "To'lov ma'lumotlaringiz to'liq emas — karta raqami yoki bank hisobingizni kiritib, qaytadan yuboring.",
      submittedAt: daysAgo(5),
      reviewedAt: daysAgo(3),
    },
  },
  "sardor@example.uz": {
    id: "user_sardor",
    email: "sardor@example.uz",
    displayName: "Sardor Toshkentov",
    avatarInitials: "ST",
    application: {
      id: "app_sardor",
      status: "REJECTED",
      currentStep: 8,
      data: {
        fullName: "Sardor Toshkentov",
        phone: "+998 99 222 33 44",
        city: "Toshkent",
        socialAccounts: [
          { id: "sa5", platform: "TELEGRAM", handle: "@sardor_channel", profileUrl: "https://t.me/sardor_channel", followerCount: 1_200 },
        ],
        contentNiches: ["Umumiy"],
        termsAccepted: true,
      },
      reviewNote:
        "Auditoriya hajmi va faolligi hozircha platformamiz kampaniyalari uchun belgilangan minimal talabga (5 000 obunachi, 3% engagement) to'g'ri kelmadi. 3 oydan so'ng qayta ariza topshirishingiz mumkin.",
      submittedAt: daysAgo(10),
      reviewedAt: daysAgo(7),
    },
  },
};
