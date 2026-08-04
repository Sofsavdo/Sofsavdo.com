import type {
  AdminUser,
  LandingSectionAdmin,
  Offer,
  Product,
} from "@sofsavdo/types";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

// Mirrors apps/api/src/roles/permissions.constants.ts's default MANAGER/ADMIN/SUPER_ADMIN grants
// (mocks never import backend code — see this file's own convention). Real mode's AdminUser.role
// is only a display label now; RoleGuard/nav-items check `permissions` directly, so the mock users
// need a real list here too or every RoleGuard-gated page would look "broken" in mock mode.
const MANAGER_MOCK_PERMISSIONS = [
  "product.read", "offer.read", "landing.read", "campaign.read", "application.read", "creator.read", "creator.review",
  "content.read", "content.review", "referral.read", "attribution.read", "order.read", "order.update", "payment.read",
  "commission.read", "payout.read", "analytics.read", "audit.read", "notification.read", "onboarding.read",
  "onboarding.review", "refund.read", "homepage.read", "competition.read",
];
const ADMIN_MOCK_PERMISSIONS = [
  ...MANAGER_MOCK_PERMISSIONS,
  "product.write", "product.archive", "offer.write", "offer.publish", "offer.pause", "offer.archive", "landing.write",
  "landing.publish", "landing.archive", "campaign.write", "campaign.publish", "campaign.pause", "campaign.complete",
  "campaign.archive", "application.review", "application.approve", "application.reject", "application.revise",
  "creator.suspend", "creator.compliance", "creator.tier", "content.approve", "content.reject", "content.revise",
  "referral.manage", "referral.review", "referral.disqualify", "order.refund", "commission.adjust", "payout.approve",
  "payout.pay", "analytics.export", "notification.manage", "onboarding.approve", "onboarding.reject",
  "onboarding.revise", "refund.manage", "homepage.write", "competition.write", "competition.publish",
  "competition.complete", "competition.archive",
];
const SUPER_ADMIN_MOCK_PERMISSIONS = [
  ...ADMIN_MOCK_PERMISSIONS,
  "creator.block", "attribution.override", "settings.read", "settings.write", "user.read", "user.manage",
  "role.read", "role.manage",
];

export const ADMIN_USERS: Record<string, AdminUser> = {
  "manager@sofsavdo.com": { id: "admin_manager", email: "manager@sofsavdo.com", displayName: "Ozoda Mirzayeva", role: "MANAGER", permissions: MANAGER_MOCK_PERMISSIONS },
  "admin@sofsavdo.com": { id: "admin_admin", email: "admin@sofsavdo.com", displayName: "Sherzod Nabiyev", role: "ADMIN", permissions: ADMIN_MOCK_PERMISSIONS },
  "super@sofsavdo.com": { id: "admin_super", email: "super@sofsavdo.com", displayName: "Kamron Tursunov", role: "SUPER_ADMIN", permissions: SUPER_ADMIN_MOCK_PERMISSIONS },
};

export const PRODUCTS: Product[] = [
  {
    id: "prod_serum",
    name: "GlowUp Vitamin C Serum",
    slug: "glowup-vitamin-c-serum",
    type: "PHYSICAL_PRODUCT",
    shortDescription: "Yuzni yorug'lantiruvchi vitamin C serumi",
    images: ["serum-1", "serum-2", "serum-3"],
    costPriceMinor: 6_200_00,
    sku: "SER-GLW-001",
    attributes: [
      { key: "Hajmi", value: "30 ml" },
      { key: "Teri turi", value: "Barcha turlar" },
    ],
    internalNotes: "Yetkazib beruvchi: Glow Cosmetics MChJ. Omborda 340 dona qoldi.",
    status: "ACTIVE",
    createdAt: daysAgo(90),
  },
  {
    id: "prod_marketplace",
    name: "Marketplace'da Savdo kursi",
    slug: "marketplace-savdo-kursi",
    type: "COURSE",
    shortDescription: "Uzum va Yandex Market'da savdo bo'yicha video kurs",
    images: ["course-1", "course-2"],
    sku: "CRS-MKT-001",
    attributes: [
      { key: "Davomiyligi", value: "6 hafta" },
      { key: "Format", value: "Video + amaliyot" },
    ],
    internalNotes: "Muallif: Otabek Rasulov. Yangi modul har chorakda qo'shiladi.",
    status: "ACTIVE",
    createdAt: daysAgo(120),
  },
  {
    id: "prod_ai",
    name: "AI va Vibe Coding kursi",
    slug: "ai-va-vibe-coding-kursi",
    type: "COURSE",
    shortDescription: "AI vositalari yordamida dastur yozish kursi",
    images: [],
    sku: "CRS-AI-001",
    attributes: [{ key: "Daraja", value: "Boshlang'ich-o'rta" }],
    status: "ACTIVE",
    createdAt: daysAgo(60),
  },
  {
    id: "prod_mvp",
    name: "Startup MVP yaratish xizmati",
    slug: "startup-mvp-xizmati",
    type: "SERVICE",
    shortDescription: "4 haftada ishlaydigan MVP",
    images: [],
    attributes: [{ key: "Muddat", value: "4 hafta" }],
    status: "ACTIVE",
    createdAt: daysAgo(45),
  },
  {
    id: "prod_ecohome",
    name: "EcoHome 12 buyumli to'plam",
    slug: "ecohome-12-buyumli-toplam",
    type: "PHYSICAL_PRODUCT",
    shortDescription: "Ekologik toza oshxona buyumlari to'plami",
    images: ["ecohome-1"],
    costPriceMinor: 320_000_00,
    sku: "HOME-ECO-012",
    attributes: [{ key: "Material", value: "Bambuk va shisha" }],
    internalNotes: "Sotuvi PAUSED — yangi partiya kutilmoqda.",
    status: "ACTIVE",
    createdAt: daysAgo(100),
  },
  {
    id: "prod_english",
    name: "Ingliz tili — Boshlang'ich daraja",
    slug: "ingliz-tili-boshlangich-daraja",
    type: "COURSE",
    shortDescription: "0 dan boshlab ingliz tili kursi",
    images: [],
    sku: "CRS-ENG-001",
    attributes: [{ key: "Davomiyligi", value: "3 oy" }],
    status: "ACTIVE",
    createdAt: daysAgo(150),
  },
];

export const OFFERS: Offer[] = [
  {
    id: "offer_serum",
    productId: "prod_serum",
    images: [],
    name: "GlowUp Vitamin C Serum",
    slug: "glowup-serum",
    headline: "Terangizga 30 kunda yangi nafas",
    subheadline:
      "Vitamin C serumi yorug'lantiradi, qorong'u dog'larni kamaytiradi va terini his qilingan darajada tiniqlashtiradi.",
    priceMinor: 18_900_00,
    compareAtPriceMinor: 24_900_00,
    currency: "UZS",
    variants: [
      { id: "v1", name: "1 dona", priceMinor: 18_900_00, isDefault: true },
      { id: "v2", name: "2 dona (10% chegirma)", priceMinor: 34_020_00, isDefault: false },
      { id: "v3", name: "3 dona (15% chegirma)", priceMinor: 48_195_00, isDefault: false },
    ],
    bonuses: ["1 dona serum sovg'a (2+ xarid qilganlarga)"],
    deliveryInfo: "Toshkent bo'ylab 1-2 kun, viloyatlarga 3-5 kun",
    paymentOptions: ["CLICK", "PAYME", "CARD", "COD"],
    ctaType: "BUY_NOW",
    ctaLabel: "Hozir buyurtma bering",
    status: "ACTIVE",
    isIndexable: true,
    createdAt: daysAgo(85),
  },
  {
    id: "offer_marketplace",
    productId: "prod_marketplace",
    images: [],
    name: "Marketplace'da Savdo — to'liq kurs",
    slug: "marketplace-kursi",
    headline: "Uzum va Yandex Market'da noldan birinchi savdongizgacha",
    subheadline: "6 haftalik amaliy video kurs — modul yakunida real mahsulot kartochkasi yaratasiz.",
    priceMinor: 2_990_000_00,
    currency: "UZS",
    variants: [
      { id: "v1", name: "To'liq to'lov", priceMinor: 2_990_000_00, isDefault: true },
      { id: "v2", name: "12 oyga bo'lib to'lash", priceMinor: 2_990_000_00, isDefault: false },
    ],
    bonuses: ["Yopiq Telegram guruhiga umrbod kirish"],
    paymentOptions: ["CLICK", "PAYME", "CARD"],
    installmentOptions: "12 oygacha",
    ctaType: "BUY_NOW",
    ctaLabel: "Kursga yozilish",
    status: "ACTIVE",
    isIndexable: true,
    createdAt: daysAgo(110),
  },
  {
    id: "offer_ai",
    productId: "prod_ai",
    images: [],
    name: "AI va Vibe Coding — Premium tarif",
    slug: "ai-vibe-coding-premium",
    headline: "AI bilan dastur yozishni o'rganing",
    subheadline: "Claude va boshqa AI vositalari yordamida real loyihalar quring.",
    priceMinor: 3_490_000_00,
    currency: "UZS",
    variants: [{ id: "v1", name: "Premium tarif", priceMinor: 3_490_000_00, isDefault: true }],
    bonuses: [],
    paymentOptions: ["CLICK", "PAYME"],
    ctaType: "BUY_NOW",
    ctaLabel: "Premium tarifga yozilish",
    status: "ACTIVE",
    isIndexable: false,
    createdAt: daysAgo(55),
  },
  {
    id: "offer_mvp",
    productId: "prod_mvp",
    images: [],
    name: "Startup MVP — 4 haftada",
    slug: "startup-mvp",
    headline: "G'oyangizni 4 haftada ishlaydigan mahsulotga aylantiring",
    subheadline: "Startap asoschilariga mo'ljallangan tezkor MVP yaratish xizmati.",
    priceMinor: 12_000_000_00,
    currency: "UZS",
    variants: [{ id: "v1", name: "Standart", priceMinor: 12_000_000_00, isDefault: true }],
    bonuses: [],
    paymentOptions: ["CLICK", "CARD"],
    ctaType: "BOOK_CALL",
    ctaLabel: "Bepul konsultatsiyaga yozilish",
    status: "ACTIVE",
    isIndexable: false,
    createdAt: daysAgo(40),
  },
  {
    id: "offer_ecohome",
    productId: "prod_ecohome",
    images: [],
    name: "EcoHome 12 buyumli to'plam",
    slug: "ecohome-set",
    headline: "Oshxonangizga ekologik toza yechim",
    subheadline: "Bambuk va shishadan tayyorlangan 12 buyumli oshxona to'plami.",
    priceMinor: 890_000_00,
    compareAtPriceMinor: 1_190_000_00,
    currency: "UZS",
    variants: [{ id: "v1", name: "To'plam", priceMinor: 890_000_00, isDefault: true }],
    bonuses: [],
    paymentOptions: ["CLICK", "PAYME", "COD"],
    ctaType: "BUY_NOW",
    ctaLabel: "Chegirma bilan xarid qilish",
    status: "PAUSED",
    isIndexable: false,
    createdAt: daysAgo(95),
  },
  {
    id: "offer_english",
    productId: "prod_english",
    images: [],
    name: "Ingliz tili — Boshlang'ich daraja",
    slug: "ingliz-tili-boshlangich",
    headline: "0 dan boshlab ingliz tilini o'rganing",
    subheadline: "3 oylik onlayn kurs, bepul sinov darsi bilan.",
    priceMinor: 990_000_00,
    currency: "UZS",
    variants: [{ id: "v1", name: "3 oylik kurs", priceMinor: 990_000_00, isDefault: true }],
    bonuses: [],
    paymentOptions: ["CLICK", "PAYME"],
    ctaType: "APPLY_NOW",
    ctaLabel: "Bepul sinov darsiga yozilish",
    status: "ACTIVE",
    isIndexable: true,
    createdAt: daysAgo(140),
  },
];

function sections(offerId: string, items: Omit<LandingSectionAdmin, "id" | "offerId">[]): LandingSectionAdmin[] {
  return items.map((item, i) => ({ id: `${offerId}_sec_${i + 1}`, offerId, ...item }));
}

export const LANDING_SECTIONS: Record<string, LandingSectionAdmin[]> = {
  offer_serum: sections("offer_serum", [
    { type: "HERO", sortOrder: 1, isActive: true, content: {} },
    {
      type: "PROBLEM",
      sortOrder: 2,
      isActive: true,
      content: {
        text: "Kunlik chang-g'ubor, quyosh nuri va uyqusizlik terini xira va charchagan ko'rinishga olib keladi — oddiy kremlar bu holatni yetarlicha tuzatmaydi.",
      },
    },
    {
      type: "SOLUTION",
      sortOrder: 3,
      isActive: true,
      content: {
        text: "Yuqori konsentratsiyali vitamin C formulasi teri hujayralarini ichkaridan qo'llab-quvvatlaydi, kollagen ishlab chiqarishni rag'batlantiradi va 30 kun ichida sezilarli farqni ta'minlaydi.",
      },
    },
    {
      type: "BENEFITS",
      sortOrder: 4,
      isActive: true,
      content: {
        items: [
          "Yuzni tabiiy tarzda yorug'lantiradi",
          "Qorong'u dog' va chandiq izlarini kamaytiradi",
          "Yengil tuzilma — yog'li terida ham qulay",
          "Dermatologlar tomonidan sinovdan o'tgan",
          "Har qanday teri turi uchun mos",
        ],
      },
    },
    {
      type: "HOW_IT_WORKS",
      sortOrder: 5,
      isActive: true,
      content: {
        steps: [
          { step: "1", text: "Yuzni tozalang va quriting" },
          { step: "2", text: "2-3 tomchi serumni yuz va bo'yinga surting" },
          { step: "3", text: "Kunduzi quyosh kremi bilan birga ishlating" },
        ],
      },
    },
    {
      type: "AUDIENCE",
      sortOrder: 6,
      isActive: true,
      content: { text: "Terisida notekislik, xiralik yoki yosh belgilaridan xavotirlanadigan 18-45 yosh ayollar uchun." },
    },
    {
      type: "NOT_FOR",
      sortOrder: 7,
      isActive: true,
      content: {
        text: "Agar siz og'ir teri kasalliklari (masalan faol ekzema) bilan kurashayotgan bo'lsangiz, avval dermatologingiz bilan maslahatlashing.",
      },
    },
    { type: "PRODUCT_GALLERY", sortOrder: 8, isActive: true, content: { images: ["serum-1", "serum-2", "serum-3"] } },
    { type: "OFFER_VARIANTS", sortOrder: 9, isActive: true, content: {} },
    {
      type: "REVIEWS",
      sortOrder: 10,
      isActive: true,
      content: {
        reviews: [
          { author: "Nilufar, Toshkent", rating: 5, text: "3 haftadan so'ng terim sezilarli darajada yorishdi. Hidi ham yoqimli." },
          { author: "Kamola, Samarqand", rating: 5, text: "Yog'li terimga juda mos keldi, og'irlik qilmaydi." },
          { author: "Sevinch, Farg'ona", rating: 4, text: "Natija bor, lekin biroz sekinroq ko'rindi — 1 oydan keyin farqni sezdim." },
        ],
      },
    },
    {
      type: "GUARANTEE",
      sortOrder: 11,
      isActive: true,
      content: { text: "Mahsulotdan mamnun bo'lmasangiz, 14 kun ichida qaytarib, pulingizni to'liq qaytarib beramiz." },
    },
    {
      type: "FAQ",
      sortOrder: 12,
      isActive: true,
      content: {
        items: [
          { q: "Necha kunda natija ko'rinadi?", a: "Ko'pchilik mijozlar 2-3 haftadan so'ng birinchi o'zgarishlarni sezishadi." },
          { q: "Kuniga necha marta ishlatish kerak?", a: "Kuniga 1-2 marta, ertalab va/yoki kechqurun." },
          { q: "Yetkazib berish qancha vaqt oladi?", a: "Toshkent bo'ylab 1-2 kun, viloyatlarga 3-5 ish kuni." },
        ],
      },
    },
    { type: "FINAL_CTA", sortOrder: 13, isActive: true, content: {} },
  ]),
  offer_marketplace: sections("offer_marketplace", [
    { type: "HERO", sortOrder: 1, isActive: true, content: {} },
    {
      type: "PROBLEM",
      sortOrder: 2,
      isActive: true,
      content: {
        text: "Ko'pchilik marketplace'da savdo boshlaganda qaysi mahsulotni tanlash, kartochkani qanday rasmiylashtirish va reklamani qayerdan boshlashni bilmay adashadi.",
      },
    },
    {
      type: "SOLUTION",
      sortOrder: 3,
      isActive: true,
      content: {
        text: "Kurs sizni mahsulot tanlashdan birinchi buyurtmagacha bosqichma-bosqich olib o'tadi — nazariya emas, amaliy uy vazifalari bilan.",
      },
    },
    {
      type: "BENEFITS",
      sortOrder: 4,
      isActive: true,
      content: {
        items: [
          "6 haftalik tuzilgan dastur",
          "Har modulda amaliy uy vazifasi",
          "Real mahsulot kartochkasi yaratish",
          "Yopiq Telegram guruhida qo'llab-quvvatlash",
          "Umrbod kirish huquqi",
        ],
      },
    },
    {
      type: "HOW_IT_WORKS",
      sortOrder: 5,
      isActive: true,
      content: {
        steps: [
          { step: "1", text: "Ro'yxatdan o'ting va birinchi modulni oching" },
          { step: "2", text: "Har hafta video darslarni ko'ring va uy vazifasini bajaring" },
          { step: "3", text: "6-hafta oxirida birinchi mahsulot kartochkangiz tayyor bo'ladi" },
        ],
      },
    },
    {
      type: "AUDIENCE",
      sortOrder: 6,
      isActive: true,
      content: { text: "O'z biznesini marketplace orqali boshlamoqchi bo'lgan 20-40 yosh tadbirkorlar uchun." },
    },
    {
      type: "NOT_FOR",
      sortOrder: 7,
      isActive: true,
      content: {
        text: "Agar allaqachon marketplace'da faol savdo qilayotgan va oylik 50+ buyurtma qabul qilayotgan bo'lsangiz, bu kurs sizga endi ortiqcha bo'lishi mumkin.",
      },
    },
    { type: "PRODUCT_GALLERY", sortOrder: 8, isActive: true, content: { images: ["course-1", "course-2"] } },
    { type: "OFFER_VARIANTS", sortOrder: 9, isActive: true, content: {} },
    {
      type: "REVIEWS",
      sortOrder: 10,
      isActive: true,
      content: {
        reviews: [
          { author: "Jasur, Toshkent", rating: 5, text: "Kursdan keyin 2 haftada birinchi buyurtmalarim tushdi." },
          { author: "Madina, Buxoro", rating: 5, text: "Uy vazifalari juda foydali, nazariya bilan cheklanib qolmaydi." },
        ],
      },
    },
    {
      type: "GUARANTEE",
      sortOrder: 11,
      isActive: true,
      content: { text: "Birinchi 2 haftada kurs sizga mos kelmasa, to'lovni to'liq qaytarib beramiz." },
    },
    {
      type: "FAQ",
      sortOrder: 12,
      isActive: true,
      content: {
        items: [
          { q: "Kursga kirish qancha vaqt amal qiladi?", a: "Umrbod — xohlagan vaqtingizda qayta ko'rishingiz mumkin." },
          { q: "Bo'lib to'lash mumkinmi?", a: "Ha, 12 oyga bo'lib to'lash imkoniyati mavjud." },
        ],
      },
    },
    { type: "FINAL_CTA", sortOrder: 13, isActive: true, content: {} },
  ]),
  offer_ai: sections("offer_ai", [
    { type: "HERO", sortOrder: 1, isActive: true, content: {} },
    { type: "BENEFITS", sortOrder: 2, isActive: true, content: { items: ["Real loyihalar bilan amaliyot", "AI vositalaridan professional foydalanish"] } },
    { type: "FINAL_CTA", sortOrder: 3, isActive: true, content: {} },
  ]),
  offer_mvp: sections("offer_mvp", [
    { type: "HERO", sortOrder: 1, isActive: true, content: {} },
    { type: "BENEFITS", sortOrder: 2, isActive: true, content: { items: ["4 haftada tayyor mahsulot", "To'liq texnik jamoa"] } },
    { type: "FINAL_CTA", sortOrder: 3, isActive: true, content: {} },
  ]),
  offer_ecohome: sections("offer_ecohome", [
    { type: "HERO", sortOrder: 1, isActive: true, content: {} },
    { type: "BENEFITS", sortOrder: 2, isActive: true, content: { items: ["Ekologik toza material", "12 xil buyum bitta to'plamda"] } },
    { type: "FINAL_CTA", sortOrder: 3, isActive: false, content: {} },
  ]),
  offer_english: sections("offer_english", [
    { type: "HERO", sortOrder: 1, isActive: true, content: {} },
    { type: "BENEFITS", sortOrder: 2, isActive: true, content: { items: ["0 dan boshlab tushunarli dastur", "Bepul sinov darsi"] } },
    { type: "FINAL_CTA", sortOrder: 3, isActive: true, content: {} },
  ]),
};

export { daysAgo, daysFromNow };
