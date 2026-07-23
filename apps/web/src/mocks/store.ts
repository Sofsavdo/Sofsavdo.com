import type {
  AdminCommission,
  AdminOrder,
  AdminOrderType,
  AdminPayout,
  AdminPromoCode,
  AdminReferralLink,
  AdminRefund,
  AdminRole,
  AdminUser,
  AdminVisitor,
  AuditLogEntry,
  Campaign,
  CampaignApplicationAdmin,
  CampaignApplicationStatus,
  CampaignAsset,
  CampaignStatus,
  CheckoutCustomerInput,
  Commission,
  CommissionStatus,
  CommissionType,
  CreateOrderInput,
  CreatorApplicationData,
  CreatorCampaign,
  CreatorCampaignStatus,
  CreatorContent,
  CreatorContentStatus,
  CreatorUser,
  DeliveryRegionPublic,
  DiscountType,
  LandingPage,
  LandingSectionAdmin,
  LandingSectionType,
  LandingStatus,
  Offer,
  OfferCtaType,
  OfferQuote,
  OfferStatus,
  OrderPublic,
  OrderStatus,
  Payout,
  PayoutMethod,
  PayoutStatus,
  Product,
  ProductStatus,
  ProductType,
  PromoValidationResult,
  ReferralContext,
  Sale,
  SocialPlatform,
} from "@rosti/types";
import {
  CAMPAIGNS,
  CREATORS,
  MALIKA_COMMISSIONS,
  MALIKA_CONTENT,
  MALIKA_CREATOR_CAMPAIGNS,
  MALIKA_PAYOUTS,
  MALIKA_PAYOUT_METHODS,
  MALIKA_SALES,
} from "./seed";
import { ADMIN_USERS, LANDING_SECTIONS, OFFERS, PRODUCTS } from "./admin-seed";

// A small in-memory + localStorage-backed mock backend. This is the seam Phase 6 replaces with
// real HTTP calls: every function here has the exact shape a real endpoint would have (async,
// can fail, returns/mutates plain data), so lib/api/*.ts call sites don't change when the mock
// is swapped for `fetch`.

const STORAGE_KEY = "rosti_mock_state_v1";
const NETWORK_DELAY_MS = [280, 620] as const;

function delay(): Promise<void> {
  const ms = NETWORK_DELAY_MS[0] + Math.random() * (NETWORK_DELAY_MS[1] - NETWORK_DELAY_MS[0]);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MockApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const ROLE_RANK: Record<AdminRole, number> = { MANAGER: 1, ADMIN: 2, SUPER_ADMIN: 3 };
function requireRole(role: AdminRole, min: AdminRole) {
  if (ROLE_RANK[role] < ROLE_RANK[min]) {
    throw new MockApiError("FORBIDDEN", "Bu amal uchun yetarli ruxsatingiz yo'q.");
  }
}

export interface PlatformSettings {
  payoutMinimumMinor: number;
  defaultAttributionWindowDays: number;
  returnPeriodDays: number;
  shippingFlatMinor: number;
  telegramNotificationsEnabled: boolean;
}

interface PersistedState {
  sessionUserId: string | null;
  applications: Record<string, CreatorUser["application"]>;
  creatorCampaigns: Record<string, CreatorCampaign[]>;
  content: Record<string, CreatorContent[]>;
  payoutMethods: Record<string, PayoutMethod[]>;
  payouts: Record<string, Payout[]>;
  registeredEmails: Record<string, CreatorUser>;
  accountStatus: Record<string, "ACTIVE" | "SUSPENDED" | "BLOCKED">;
  orders: OrderPublic[];
  promoUsageCounts: Record<string, number>;
  dynamicSales: Record<string, Sale[]>;
  dynamicCommissions: Record<string, Commission[]>;

  adminSessionUserId: string | null;
  products: Product[];
  offers: Offer[];
  landingSections: Record<string, LandingSectionAdmin[]>;
  landingPages: Record<string, LandingPage>;
  campaignsExtra: Campaign[];
  adminOrders: AdminOrder[];
  adminCommissions: AdminCommission[];
  refunds: AdminRefund[];
  auditLog: AuditLogEntry[];
  settings: PlatformSettings;
}

function freshState(): PersistedState {
  return {
    sessionUserId: null,
    applications: { user_malika: CREATORS["malika@example.uz"]!.application },
    creatorCampaigns: { user_malika: MALIKA_CREATOR_CAMPAIGNS },
    content: { user_malika: MALIKA_CONTENT },
    payoutMethods: { user_malika: MALIKA_PAYOUT_METHODS },
    payouts: { user_malika: MALIKA_PAYOUTS },
    registeredEmails: {},
    accountStatus: {},
    orders: [],
    promoUsageCounts: {},
    dynamicSales: {},
    dynamicCommissions: {},

    adminSessionUserId: null,
    products: PRODUCTS,
    offers: OFFERS,
    landingSections: LANDING_SECTIONS,
    // Every offer that already has seeded landing content is treated as PUBLISHED in mock mode —
    // this mirrors the mock's pre-existing (ungated) public offer page behavior; the real backend
    // enforces the actual publish gate (see LandingsService.getPublicByOfferSlug).
    landingPages: Object.fromEntries(
      Object.keys(LANDING_SECTIONS).map((offerId) => [
        offerId,
        {
          id: `landing_${offerId}`,
          offerId,
          template: "default",
          status: "PUBLISHED" as LandingStatus,
          seoKeywords: [],
          createdAt: new Date().toISOString(),
        } satisfies LandingPage,
      ]),
    ),
    campaignsExtra: [],
    adminOrders: [],
    adminCommissions: [],
    refunds: [],
    auditLog: [],
    settings: {
      payoutMinimumMinor: 100_000_00,
      defaultAttributionWindowDays: 30,
      returnPeriodDays: 14,
      shippingFlatMinor: 25_000_00,
      telegramNotificationsEnabled: true,
    },
  };
}

let state: PersistedState | null = null;

function load(): PersistedState {
  if (state) return state;
  if (typeof window === "undefined") {
    state = freshState();
    return state;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    state = raw ? { ...freshState(), ...(JSON.parse(raw) as PersistedState) } : freshState();
  } catch {
    state = freshState();
  }
  return state;
}

function save() {
  if (typeof window === "undefined" || !state) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function audit(actor: string, action: string, entityType: string, entityId: string, reason?: string, before?: unknown, after?: unknown) {
  const s = load();
  s.auditLog = [
    { id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, actor, action, entityType, entityId, reason, before, after, createdAt: new Date().toISOString() },
    ...s.auditLog,
  ];
}

function findCreatorByEmail(email: string): CreatorUser | null {
  const s = load();
  const seeded = CREATORS[email];
  if (seeded) {
    const overriddenApp = s.applications[seeded.id];
    return { ...seeded, application: overriddenApp ?? seeded.application, accountStatus: s.accountStatus[seeded.id] ?? "ACTIVE" };
  }
  const reg = s.registeredEmails[email];
  return reg ? { ...reg, accountStatus: s.accountStatus[reg.id] ?? "ACTIVE" } : null;
}

function getUserById(userId: string): CreatorUser | null {
  const s = load();
  for (const email of Object.keys(CREATORS)) {
    if (CREATORS[email]!.id === userId) return findCreatorByEmail(email);
  }
  for (const email of Object.keys(s.registeredEmails)) {
    if (s.registeredEmails[email]!.id === userId) return findCreatorByEmail(email);
  }
  return null;
}

function allCreatorEmails(): string[] {
  return [...Object.keys(CREATORS), ...Object.keys(load().registeredEmails)];
}

// ---- Auth ----

export async function apiLogin(email: string, password: string): Promise<CreatorUser> {
  await delay();
  const user = findCreatorByEmail(email.trim().toLowerCase());
  if (!user) throw new MockApiError("NOT_FOUND", "Bu email bilan ro'yxatdan o'tilmagan.");
  if (password.length < 6) {
    throw new MockApiError("INVALID_CREDENTIALS", "Email yoki parol noto'g'ri.");
  }
  if (user.accountStatus === "BLOCKED") {
    throw new MockApiError("BLOCKED", "Hisobingiz bloklangan. Qo'llab-quvvatlash bilan bog'laning.");
  }
  const s = load();
  s.sessionUserId = user.id;
  save();
  return user;
}

export async function apiRegister(email: string, fullName: string, password: string): Promise<CreatorUser> {
  await delay();
  const normalizedEmail = email.trim().toLowerCase();
  if (findCreatorByEmail(normalizedEmail)) {
    throw new MockApiError("EMAIL_TAKEN", "Bu email allaqachon ro'yxatdan o'tgan.");
  }
  if (password.length < 6) {
    throw new MockApiError("WEAK_PASSWORD", "Parol kamida 6 belgidan iborat bo'lishi kerak.");
  }
  const s = load();
  const id = `user_${Date.now()}`;
  const user: CreatorUser = {
    id,
    email: normalizedEmail,
    displayName: fullName,
    avatarInitials: fullName
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase(),
    application: { id: `app_${id}`, status: "DRAFT", currentStep: 1, data: { fullName } },
  };
  s.registeredEmails[normalizedEmail] = user;
  s.applications[id] = user.application;
  s.creatorCampaigns[id] = [];
  s.content[id] = [];
  s.payoutMethods[id] = [];
  s.payouts[id] = [];
  s.sessionUserId = id;
  save();
  return user;
}

export async function apiForgotPassword(email: string): Promise<{ sent: boolean }> {
  await delay();
  const user = findCreatorByEmail(email.trim().toLowerCase());
  if (!user) throw new MockApiError("NOT_FOUND", "Bu email bilan ro'yxatdan o'tilmagan.");
  return { sent: true };
}

export function apiLogout() {
  const s = load();
  s.sessionUserId = null;
  save();
}

export async function apiGetSession(): Promise<CreatorUser | null> {
  await delay();
  const s = load();
  if (!s.sessionUserId) return null;
  return getUserById(s.sessionUserId);
}

// ---- Application / onboarding ----

export async function apiUpdateApplication(
  userId: string,
  patch: Partial<CreatorApplicationData>,
  step: number,
): Promise<CreatorUser["application"]> {
  await delay();
  const s = load();
  const current = s.applications[userId];
  if (!current) throw new MockApiError("NOT_FOUND", "Ariza topilmadi.");
  const updated: CreatorUser["application"] = {
    ...current,
    currentStep: Math.max(current.currentStep, step),
    data: { ...current.data, ...patch },
    status: current.status === "REVISION_REQUESTED" ? "DRAFT" : current.status,
  };
  s.applications[userId] = updated;
  save();
  return updated;
}

export async function apiSubmitApplication(userId: string): Promise<CreatorUser["application"]> {
  await delay();
  const s = load();
  const current = s.applications[userId];
  if (!current) throw new MockApiError("NOT_FOUND", "Ariza topilmadi.");
  if (!current.data.termsAccepted) {
    throw new MockApiError("TERMS_REQUIRED", "Davom etish uchun shartlarni qabul qiling.");
  }
  const updated: CreatorUser["application"] = {
    ...current,
    status: "SUBMITTED",
    submittedAt: new Date().toISOString(),
  };
  s.applications[userId] = updated;
  save();
  return updated;
}

// ---- Campaigns (creator-facing read) ----

export async function apiGetCampaigns(): Promise<Campaign[]> {
  await delay();
  return [...CAMPAIGNS, ...load().campaignsExtra];
}

export async function apiGetCampaign(id: string): Promise<Campaign | null> {
  await delay();
  return [...CAMPAIGNS, ...load().campaignsExtra].find((c) => c.id === id) ?? null;
}

export async function apiGetMyCampaigns(userId: string): Promise<CreatorCampaign[]> {
  await delay();
  return load().creatorCampaigns[userId] ?? [];
}

function slugifyCode(...parts: string[]): string {
  return parts.join("-").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 28);
}

function generateReferralAssets(creatorSlug: string, campaign: Campaign) {
  const code = slugifyCode(creatorSlug, campaign.slug);
  return {
    referralLink: {
      code,
      fullUrl: `https://rosti.uz/o/${campaign.offer.slug}?ref=${code}`,
      shortUrl: `https://rosti.uz/r/${code}`,
      clicks: 0,
      createdAt: new Date().toISOString(),
    },
    promoCode: {
      code: `${creatorSlug.toUpperCase().slice(0, 8)}10`,
      discountType: "PERCENTAGE" as DiscountType,
      discountValue: 1000,
      usageCount: 0,
    },
  };
}

export async function apiApplyToCampaign(userId: string, campaignId: string): Promise<CreatorCampaign> {
  await delay();
  const s = load();
  const campaign = [...CAMPAIGNS, ...s.campaignsExtra].find((c) => c.id === campaignId);
  if (!campaign) throw new MockApiError("NOT_FOUND", "Kampaniya topilmadi.");
  const existing = (s.creatorCampaigns[userId] ?? []).find((cc) => cc.campaignId === campaignId);
  if (existing) throw new MockApiError("ALREADY_APPLIED", "Siz bu kampaniyaga allaqachon murojaat qilgansiz.");
  if (campaign.approvedCreatorCount >= campaign.creatorLimit) {
    throw new MockApiError("CREATOR_LIMIT_REACHED", "Kampaniya uchun creator limiti to'lgan.");
  }
  const status: CreatorCampaignStatus = campaign.requiresApproval ? "UNDER_REVIEW" : "APPROVED";
  const user = getUserById(userId);
  const creatorSlug = (user?.displayName ?? "creator").split(" ")[0] ?? "creator";
  const creatorCampaign: CreatorCampaign = {
    id: `cc_${Date.now()}`,
    campaignId,
    campaign,
    status,
    joinedAt: new Date().toISOString(),
    ...(status === "APPROVED" ? generateReferralAssets(creatorSlug, campaign) : {}),
  };
  s.creatorCampaigns[userId] = [...(s.creatorCampaigns[userId] ?? []), creatorCampaign];
  save();
  return creatorCampaign;
}

// ---- Content ----

export async function apiGetContent(userId: string): Promise<CreatorContent[]> {
  await delay();
  return load().content[userId] ?? [];
}

export async function apiSubmitContent(
  userId: string,
  input: {
    creatorCampaignId: string;
    campaignName: string;
    caption: string;
    platform: SocialPlatform;
    draftFileNames: string[];
  },
): Promise<CreatorContent> {
  await delay();
  const s = load();
  const now = new Date().toISOString();
  const list = s.content[userId] ?? [];
  const existingIdx = list.findIndex((c) => c.creatorCampaignId === input.creatorCampaignId);
  const nextStatus: CreatorContentStatus = "SUBMITTED";
  const record: CreatorContent = {
    id: existingIdx >= 0 ? list[existingIdx]!.id : `content_${Date.now()}`,
    creatorCampaignId: input.creatorCampaignId,
    campaignName: input.campaignName,
    status: nextStatus,
    caption: input.caption,
    platform: input.platform,
    draftFileNames: input.draftFileNames,
    history: [...(existingIdx >= 0 ? list[existingIdx]!.history : []), { status: nextStatus, at: now }],
    submittedAt: now,
    updatedAt: now,
  };
  if (existingIdx >= 0) list[existingIdx] = record;
  else list.push(record);
  s.content[userId] = [...list];
  save();
  return record;
}

// ---- Sales / commissions / balance / payouts ----
// Malika's seeded data plus anything created dynamically (Phase 5 admin-driven orders) for any
// creator, merged at read time.

export async function apiGetSales(userId: string): Promise<Sale[]> {
  await delay();
  const seeded = userId === "user_malika" ? MALIKA_SALES : [];
  return [...seeded, ...(load().dynamicSales[userId] ?? [])];
}

export async function apiGetCommissions(userId: string): Promise<Commission[]> {
  await delay();
  const seeded = userId === "user_malika" ? MALIKA_COMMISSIONS : [];
  return [...seeded, ...(load().dynamicCommissions[userId] ?? [])];
}

export async function apiGetBalance(userId: string) {
  await delay();
  const commissions = await apiGetCommissions(userId);
  const payouts = load().payouts[userId] ?? [];
  const sum = (pred: (s: string) => boolean) =>
    commissions.filter((c) => pred(c.status)).reduce((acc, c) => acc + c.amountMinor, 0);
  const payoutRequestedMinor = payouts
    .filter((p) => p.status === "REQUESTED" || p.status === "UNDER_REVIEW" || p.status === "APPROVED" || p.status === "PROCESSING")
    .reduce((acc, p) => acc + p.amountMinor, 0);
  return {
    pendingMinor: sum((s) => s === "PENDING"),
    approvedMinor: sum((s) => s === "APPROVED"),
    availableMinor: Math.max(sum((s) => s === "APPROVED" || s === "PAYABLE") - payoutRequestedMinor, 0),
    payoutRequestedMinor,
    paidMinor: sum((s) => s === "PAID"),
    minimumPayoutMinor: load().settings.payoutMinimumMinor,
  };
}

export async function apiGetPayoutMethods(userId: string): Promise<PayoutMethod[]> {
  await delay();
  return load().payoutMethods[userId] ?? [];
}

export async function apiAddPayoutMethod(
  userId: string,
  input: { cardNumber: string; cardHolder: string },
): Promise<PayoutMethod> {
  await delay();
  const s = load();
  const last4 = input.cardNumber.replace(/\s/g, "").slice(-4);
  const method: PayoutMethod = {
    id: `pm_${Date.now()}`,
    type: "CARD",
    label: `•••• ${last4} — ${input.cardHolder}`,
    isDefault: (s.payoutMethods[userId] ?? []).length === 0,
  };
  s.payoutMethods[userId] = [...(s.payoutMethods[userId] ?? []), method];
  save();
  return method;
}

export async function apiGetPayouts(userId: string): Promise<Payout[]> {
  await delay();
  return load().payouts[userId] ?? [];
}

export async function apiRequestPayout(
  userId: string,
  input: { amountMinor: number; payoutMethodId: string },
): Promise<Payout> {
  await delay();
  const s = load();
  const balance = await apiGetBalance(userId);
  if (input.amountMinor < balance.minimumPayoutMinor) {
    throw new MockApiError(
      "BELOW_MINIMUM",
      `Minimal so'rov miqdori ${(balance.minimumPayoutMinor / 100).toLocaleString("uz-UZ")} so'm.`,
    );
  }
  if (input.amountMinor > balance.availableMinor) {
    throw new MockApiError("INSUFFICIENT_BALANCE", "So'ralgan miqdor mavjud balansdan oshib ketdi.");
  }
  const method = (s.payoutMethods[userId] ?? []).find((m) => m.id === input.payoutMethodId);
  if (!method) throw new MockApiError("NOT_FOUND", "To'lov usuli topilmadi.");
  const payout: Payout = {
    id: `payout_${Date.now()}`,
    amountMinor: input.amountMinor,
    status: "REQUESTED",
    payoutMethodLabel: method.label,
    requestedAt: new Date().toISOString(),
  };
  s.payouts[userId] = [payout, ...(s.payouts[userId] ?? [])];
  save();
  return payout;
}

// ---- Dashboard (creator) ----

export async function apiGetDashboardStats(userId: string) {
  await delay();
  const isMalika = userId === "user_malika";
  const sales = await apiGetSales(userId);
  const genSeries = (days: number) =>
    Array.from({ length: days }, (_, i) => {
      const clicks = isMalika ? Math.round(20 + Math.random() * 60) : Math.round(Math.random() * 3);
      const orders = Math.round(clicks * (isMalika ? 0.04 + Math.random() * 0.03 : 0.01));
      return {
        date: new Date(Date.now() - (days - i) * 86_400_000).toISOString().slice(0, 10),
        clicks,
        orders,
        revenueMinor: orders * 1_890_00,
      };
    });
  const series30d = genSeries(30);
  const series7d = series30d.slice(-7);
  const series90d = genSeries(90);
  const todaySales = sales.filter((s) => new Date(s.createdAt).toDateString() === new Date().toDateString());
  const balance = await apiGetBalance(userId);
  return {
    today: {
      clicks: isMalika ? 34 : 0,
      orders: todaySales.length,
      revenueMinor: todaySales.reduce((a, s) => a + s.amountMinor, 0),
    },
    monthToDate: {
      salesMinor: sales.reduce((a, s) => a + s.amountMinor, 0),
      commissionMinor: sales.reduce((a, s) => a + s.commissionMinor, 0),
    },
    pendingCommissionMinor: balance.pendingMinor,
    approvedCommissionMinor: balance.approvedMinor,
    availableBalanceMinor: balance.availableMinor,
    conversionRate: isMalika ? 0.048 : 0,
    epcMinor: isMalika ? 1_240_00 : 0,
    series7d,
    series30d,
    series90d,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Public offer / referral / checkout (Phase 4, now reading the relational admin store)
// ────────────────────────────────────────────────────────────────────────────

interface AttributionMatch {
  creatorId: string;
  creatorDisplayName: string;
  promoCode?: { code: string; discountType: DiscountType; discountValue: number };
}

function findByReferralCode(refCode: string): AttributionMatch | null {
  const s = load();
  for (const [userId, list] of Object.entries(s.creatorCampaigns)) {
    const cc = list.find((c) => c.referralLink?.code === refCode);
    if (cc) {
      const user = getUserById(userId);
      return { creatorId: userId, creatorDisplayName: user?.displayName ?? "Creator", promoCode: cc.promoCode };
    }
  }
  return null;
}

function findByPromoCode(code: string): (AttributionMatch & { offerSlug: string; campaignId: string; campaignName: string }) | null {
  const normalized = code.trim().toUpperCase();
  const s = load();
  for (const [userId, list] of Object.entries(s.creatorCampaigns)) {
    const cc = list.find((c) => c.promoCode?.code === normalized);
    if (cc) {
      const user = getUserById(userId);
      return {
        creatorId: userId,
        creatorDisplayName: user?.displayName ?? "Creator",
        promoCode: cc.promoCode,
        offerSlug: cc.campaign.offer.slug,
        campaignId: cc.campaignId,
        campaignName: cc.campaign.name,
      };
    }
  }
  return null;
}

function getOfferBySlug(slug: string): Offer | null {
  return load().offers.find((o) => o.slug === slug) ?? null;
}

export async function apiGetOfferPublic(
  slug: string,
  refCode?: string,
): Promise<{ offer: Offer; productType: ProductType; deliveryRegions: DeliveryRegionPublic[]; sections: LandingSectionAdmin[]; referral?: ReferralContext } | null> {
  await delay();
  const offer = getOfferBySlug(slug);
  if (!offer) return null;
  const product = load().products.find((p) => p.id === offer.productId);
  const productType = product?.type ?? "PHYSICAL_PRODUCT";
  const sections = (load().landingSections[offer.id] ?? []).filter((sec) => sec.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  // Mock mode has no delivery-region data model (real-mode-only — see DECISIONS.md ADR-013).
  const deliveryRegions: DeliveryRegionPublic[] = [];
  if (!refCode) return { offer, productType, deliveryRegions, sections };
  const match = findByReferralCode(refCode);
  if (!match) return { offer, productType, deliveryRegions, sections };
  return {
    offer,
    productType,
    deliveryRegions,
    sections,
    referral: {
      creatorDisplayName: match.creatorDisplayName,
      promoCode: match.promoCode?.code,
      discountLabel:
        match.promoCode && match.promoCode.discountValue > 0
          ? match.promoCode.discountType === "PERCENTAGE"
            ? `${(match.promoCode.discountValue / 100).toFixed(0)}% chegirma`
            : `${(match.promoCode.discountValue / 100).toLocaleString("uz-UZ")} so'm chegirma`
          : undefined,
    },
  };
}

// Mock mode never requires a region (no delivery-region data model — see apiGetOfferPublic above);
// the quote is always just the offer price.
export async function apiGetOfferQuote(slug: string): Promise<OfferQuote> {
  await delay();
  const offer = getOfferBySlug(slug);
  if (!offer) throw new MockApiError("NOT_FOUND", "Offer topilmadi.");
  return {
    priceMinor: offer.priceMinor,
    deliveryFeeMinor: 0,
    totalMinor: offer.priceMinor,
    currency: offer.currency,
    regionRequired: false,
  };
}

// Admin-preview counterpart to apiGetOfferPublic, keyed by offerId (the admin builder only knows
// the offer's id, not necessarily its slug) — mock mode's public read was never gated on publish
// status, so this is just that same payload reused, matching real mode's "preview bypasses the
// gate" semantics for free.
export async function apiGetOfferPublicByOfferId(offerId: string): Promise<{
  offer: Offer;
  productType: ProductType;
  landing: { template: string; seoTitle?: string; seoDescription?: string; seoKeywords: string[]; ogImageUrl?: string };
  sections: LandingSectionAdmin[];
} | null> {
  await delay();
  const s = load();
  const offer = s.offers.find((o) => o.id === offerId);
  if (!offer) return null;
  const product = s.products.find((p) => p.id === offer.productId);
  const productType = product?.type ?? "PHYSICAL_PRODUCT";
  const sections = (s.landingSections[offer.id] ?? []).sort((a, b) => a.sortOrder - b.sortOrder);
  const landingPage = s.landingPages[offerId];
  return {
    offer,
    productType,
    landing: {
      template: landingPage?.template ?? "default",
      seoTitle: landingPage?.seoTitle,
      seoDescription: landingPage?.seoDescription,
      seoKeywords: landingPage?.seoKeywords ?? [],
      ogImageUrl: landingPage?.ogImageUrl,
    },
    sections,
  };
}

export async function apiValidatePromoCode(offerSlug: string, code: string): Promise<PromoValidationResult> {
  await delay();
  const match = findByPromoCode(code);
  if (!match || !match.promoCode) throw new MockApiError("NOT_FOUND", "Promo kod topilmadi.");
  if (match.offerSlug !== offerSlug) throw new MockApiError("INVALID_OFFER", "Bu promo kod ushbu taklif uchun amal qilmaydi.");
  const offer = getOfferBySlug(offerSlug);
  if (!offer) throw new MockApiError("INVALID_OFFER", "Taklif topilmadi.");
  const discountMinor =
    match.promoCode.discountType === "PERCENTAGE"
      ? Math.round((offer.priceMinor * match.promoCode.discountValue) / 10000)
      : match.promoCode.discountValue;
  return { code: match.promoCode.code, discountType: match.promoCode.discountType, discountValue: match.promoCode.discountValue, discountMinor };
}

function orderTypeForProduct(type: ProductType): AdminOrderType {
  switch (type) {
    case "PHYSICAL_PRODUCT":
      return "PHYSICAL";
    case "DIGITAL_PRODUCT":
      return "DIGITAL";
    case "COURSE":
      return "COURSE";
    case "SERVICE":
    case "CONSULTATION":
      return "SERVICE";
  }
}

function commissionForCampaign(campaign: Campaign, baseAmountMinor: number): number {
  switch (campaign.commissionType) {
    case "PERCENTAGE":
      return Math.round((baseAmountMinor * (campaign.commissionRateBps ?? 0)) / 10000);
    case "FIXED_AMOUNT":
      return campaign.commissionAmountMinor ?? 0;
  }
}

export async function apiCreateOrder(input: CreateOrderInput): Promise<OrderPublic> {
  await delay();
  const s = load();

  const existing = s.orders.find((o) => o.publicToken === `idem_${input.idempotencyKey}`);
  if (existing) return existing; // idempotency: replay returns the original order, no duplicate

  const offer = getOfferBySlug(input.offerSlug);
  if (!offer) throw new MockApiError("NOT_FOUND", "Taklif topilmadi.");
  const variant = offer.variants.find((v) => v.id === input.variantId);
  if (!variant) throw new MockApiError("NOT_FOUND", "Tanlangan variant topilmadi.");
  const product = s.products.find((p) => p.id === offer.productId);

  let discountMinor = 0;
  let attribution: AttributionMatch | null = null;
  let attributionSource: "PROMO_CODE" | "REFERRAL_VISIT" | undefined;
  let campaignForCommission: Campaign | null = null;

  if (input.promoCode) {
    const result = await apiValidatePromoCode(input.offerSlug, input.promoCode);
    discountMinor = result.discountMinor;
    const match = findByPromoCode(input.promoCode);
    attribution = match;
    attributionSource = "PROMO_CODE";
    if (match) campaignForCommission = [...CAMPAIGNS, ...s.campaignsExtra].find((c) => c.id === match.campaignId) ?? null;
  } else if (input.refCode) {
    // Attribution only — a bare referral click credits the creator but must never silently
    // change the price. The checkout page only ever shows a discount once the buyer explicitly
    // applies a promo code; if createOrder also discounted here off `refCode` alone, the price
    // the buyer saw before submitting and the price they were actually charged could disagree.
    const match = findByReferralCode(input.refCode);
    attribution = match;
    attributionSource = match ? "REFERRAL_VISIT" : undefined;
    if (match) {
      for (const cc of s.creatorCampaigns[match.creatorId] ?? []) {
        if (cc.referralLink?.code === input.refCode) {
          campaignForCommission = cc.campaign;
          break;
        }
      }
    }
  }

  const totalMinor = Math.max(variant.priceMinor - discountMinor, 0);
  const now = new Date().toISOString();
  const publicToken = `idem_${input.idempotencyKey}`;

  const order: OrderPublic = {
    id: `order_${Date.now()}`,
    publicToken,
    offerName: offer.name,
    variantName: variant.name,
    totalMinor,
    discountMinor,
    currency: offer.currency,
    paymentMethod: input.paymentMethod,
    customer: input.customer,
    createdAt: now,
    attributedCreatorName: attribution?.creatorDisplayName,
  };
  s.orders = [...s.orders, order];

  const adminOrder: AdminOrder = {
    id: order.id,
    publicToken,
    type: product ? orderTypeForProduct(product.type) : "LEAD",
    offerId: offer.id,
    offerName: offer.name,
    campaignId: campaignForCommission?.id,
    campaignName: campaignForCommission?.name,
    customer: input.customer,
    status: "NEW",
    items: [{ variantName: variant.name, quantity: 1, unitPriceMinor: variant.priceMinor }],
    subtotalMinor: variant.priceMinor,
    discountMinor,
    shippingMinor: product?.type === "PHYSICAL_PRODUCT" ? s.settings.shippingFlatMinor : 0,
    totalMinor: totalMinor + (product?.type === "PHYSICAL_PRODUCT" ? s.settings.shippingFlatMinor : 0),
    currency: offer.currency,
    attributionSource,
    attributedCreatorId: attribution?.creatorId,
    attributedCreatorName: attribution?.creatorDisplayName,
    paymentMethod: input.paymentMethod,
    paymentStatus: "PAID",
    statusHistory: [{ status: "NEW", at: now }],
    createdAt: now,
  };

  if (attribution && campaignForCommission) {
    const commissionAmount = commissionForCampaign(campaignForCommission, totalMinor);
    const commissionId = `comm_${Date.now()}`;
    adminOrder.commissionId = commissionId;

    const adminCommission: AdminCommission = {
      id: commissionId,
      orderId: order.id,
      orderPublicToken: publicToken,
      creatorId: attribution.creatorId,
      creatorName: attribution.creatorDisplayName,
      campaignName: campaignForCommission.name,
      commissionType: campaignForCommission.commissionType,
      commissionValue:
        campaignForCommission.commissionType === "PERCENTAGE"
          ? (campaignForCommission.commissionRateBps ?? 0)
          : (campaignForCommission.commissionAmountMinor ?? 0),
      baseAmountMinor: totalMinor,
      amountMinor: commissionAmount,
      status: "PENDING",
      ledger: [{ type: "ACCRUAL", amountMinor: commissionAmount, at: now }],
      createdAt: now,
    };
    s.adminCommissions = [...s.adminCommissions, adminCommission];

    const customerMasked = `${input.customer.fullName.split(" ")[0]?.[0] ?? "M"}. ${input.customer.fullName.split(" ").slice(-1)[0] ?? ""}, ${input.customer.phone.slice(0, 9)}${"*".repeat(4)}${input.customer.phone.slice(-2)}`;
    const sale: Sale = {
      id: `sale_${Date.now()}`,
      orderPublicToken: publicToken,
      createdAt: now,
      campaignName: campaignForCommission.name,
      offerName: offer.name,
      customerMasked,
      amountMinor: totalMinor,
      discountMinor,
      commissionBaseMinor: totalMinor,
      commissionMinor: commissionAmount,
      orderStatus: "NEW",
      attributionSource: attributionSource ?? "REFERRAL_VISIT",
    };
    s.dynamicSales[attribution.creatorId] = [sale, ...(s.dynamicSales[attribution.creatorId] ?? [])];

    const commission: Commission = {
      id: commissionId,
      saleId: sale.id,
      campaignName: campaignForCommission.name,
      baseAmountMinor: totalMinor,
      amountMinor: commissionAmount,
      status: "PENDING",
      createdAt: now,
    };
    s.dynamicCommissions[attribution.creatorId] = [commission, ...(s.dynamicCommissions[attribution.creatorId] ?? [])];
  }

  s.adminOrders = [adminOrder, ...s.adminOrders];

  if (input.promoCode) {
    s.promoUsageCounts[input.promoCode.toUpperCase()] = (s.promoUsageCounts[input.promoCode.toUpperCase()] ?? 0) + 1;
  }
  save();
  return order;
}

export async function apiGetOrderPublic(publicToken: string): Promise<OrderPublic | null> {
  await delay();
  return load().orders.find((o) => o.publicToken === publicToken) ?? null;
}

// ────────────────────────────────────────────────────────────────────────────
// ADMIN — Phase 5
// ────────────────────────────────────────────────────────────────────────────

// ---- Admin auth ----

export async function apiAdminLogin(email: string, password: string): Promise<AdminUser> {
  await delay();
  const user = ADMIN_USERS[email.trim().toLowerCase()];
  if (!user) throw new MockApiError("NOT_FOUND", "Bu email bilan admin topilmadi.");
  if (password.length < 6) throw new MockApiError("INVALID_CREDENTIALS", "Email yoki parol noto'g'ri.");
  const s = load();
  s.adminSessionUserId = user.id;
  save();
  return user;
}

export function apiAdminLogout() {
  const s = load();
  s.adminSessionUserId = null;
  save();
}

export async function apiAdminGetSession(): Promise<AdminUser | null> {
  await delay();
  const s = load();
  if (!s.adminSessionUserId) return null;
  return Object.values(ADMIN_USERS).find((u) => u.id === s.adminSessionUserId) ?? null;
}

// Dev-only convenience so the three permission tiers can be exercised without three logins —
// never exposed in a production build.
export async function apiAdminDevSwitchRole(role: AdminRole): Promise<AdminUser> {
  if (process.env.NODE_ENV === "production") {
    throw new MockApiError("FORBIDDEN", "Role switching faqat development rejimida ishlaydi.");
  }
  await delay();
  const user = Object.values(ADMIN_USERS).find((u) => u.role === role)!;
  const s = load();
  s.adminSessionUserId = user.id;
  save();
  return user;
}

function currentAdmin(): AdminUser {
  const s = load();
  const user = Object.values(ADMIN_USERS).find((u) => u.id === s.adminSessionUserId);
  if (!user) throw new MockApiError("UNAUTHORIZED", "Admin sifatida kiring.");
  return user;
}

// ---- Products ----

export async function apiAdminGetProducts(): Promise<Product[]> {
  await delay();
  return load().products;
}

export async function apiAdminGetProduct(id: string): Promise<Product | null> {
  await delay();
  return load().products.find((p) => p.id === id) ?? null;
}

export async function apiAdminCreateProduct(input: Omit<Product, "id" | "createdAt" | "status"> & { status?: ProductStatus }): Promise<Product> {
  await delay();
  const s = load();
  const product: Product = { id: `prod_${Date.now()}`, status: "DRAFT", createdAt: new Date().toISOString(), ...input };
  s.products = [product, ...s.products];
  audit(currentAdmin().displayName, "product.created", "Product", product.id, undefined, undefined, product);
  save();
  return product;
}

export async function apiAdminUpdateProduct(id: string, patch: Partial<Product>): Promise<Product> {
  await delay();
  const s = load();
  const idx = s.products.findIndex((p) => p.id === id);
  if (idx < 0) throw new MockApiError("NOT_FOUND", "Mahsulot topilmadi.");
  const before = s.products[idx]!;
  const updated = { ...before, ...patch };
  s.products[idx] = updated;
  audit(currentAdmin().displayName, "product.updated", "Product", id, undefined, before, updated);
  save();
  return updated;
}

export async function apiAdminArchiveProduct(id: string): Promise<Product> {
  return apiAdminUpdateProduct(id, { status: "ARCHIVED" });
}

// ---- Offers ----

export async function apiAdminGetOffers(): Promise<Offer[]> {
  await delay();
  return load().offers;
}

export async function apiAdminGetOffer(id: string): Promise<Offer | null> {
  await delay();
  return load().offers.find((o) => o.id === id) ?? null;
}

export interface CreateOfferInput {
  productId: string;
  name: string;
  slug: string;
  headline: string;
  subheadline: string;
  priceMinor: number;
  compareAtPriceMinor?: number;
  currency: string;
  variants: { id: string; name: string; priceMinor: number; isDefault: boolean }[];
  bonuses: string[];
  deliveryInfo?: string;
  paymentOptions: string[];
  installmentOptions?: string;
  ctaType: OfferCtaType;
  ctaLabel: string;
  startsAt?: string;
  endsAt?: string;
}

export async function apiAdminCreateOffer(input: CreateOfferInput): Promise<Offer> {
  await delay();
  const s = load();
  if (s.offers.some((o) => o.slug === input.slug)) {
    throw new MockApiError("SLUG_TAKEN", "Bu slug band. Boshqasini tanlang.");
  }
  const offer: Offer = { id: `offer_${Date.now()}`, status: "DRAFT", isIndexable: false, createdAt: new Date().toISOString(), ...input };
  s.offers = [offer, ...s.offers];
  s.landingSections[offer.id] = [
    { id: `${offer.id}_sec_1`, offerId: offer.id, type: "HERO", sortOrder: 1, isActive: true, content: {} },
    { id: `${offer.id}_sec_2`, offerId: offer.id, type: "FINAL_CTA", sortOrder: 2, isActive: true, content: {} },
  ];
  audit(currentAdmin().displayName, "offer.created", "Offer", offer.id, undefined, undefined, offer);
  save();
  return offer;
}

export async function apiAdminUpdateOffer(id: string, patch: Partial<Offer>): Promise<Offer> {
  await delay();
  const s = load();
  const idx = s.offers.findIndex((o) => o.id === id);
  if (idx < 0) throw new MockApiError("NOT_FOUND", "Offer topilmadi.");
  const before = s.offers[idx]!;
  const updated = { ...before, ...patch };
  s.offers[idx] = updated;
  // Cascade: campaigns referencing this offer keep a live-ish summary in sync.
  s.campaignsExtra = s.campaignsExtra.map((c) =>
    c.offer.id === id
      ? { ...c, offer: { id: updated.id, name: updated.name, slug: updated.slug, productType: c.offer.productType, priceMinor: updated.priceMinor, compareAtPriceMinor: updated.compareAtPriceMinor, currency: updated.currency } }
      : c,
  );
  audit(currentAdmin().displayName, "offer.updated", "Offer", id, undefined, before, updated);
  save();
  return updated;
}

// The real backend exposes dedicated activate/pause/archive endpoints backed by an explicit
// transition matrix (see offers.service.ts's ALLOWED_TRANSITIONS) rather than a free-form status
// PATCH. Mock mode has no such matrix to enforce, so these just delegate to apiAdminUpdateOffer —
// good enough for UI wiring/demo purposes, not a substitute for the real validation.
export async function apiAdminActivateOffer(id: string): Promise<Offer> {
  return apiAdminUpdateOffer(id, { status: "ACTIVE" });
}

export async function apiAdminPauseOffer(id: string): Promise<Offer> {
  return apiAdminUpdateOffer(id, { status: "PAUSED" });
}

export async function apiAdminArchiveOffer(id: string): Promise<Offer> {
  return apiAdminUpdateOffer(id, { status: "ARCHIVED" });
}

// ---- Landing pages ----

const LANDING_ALLOWED_TRANSITIONS: Record<LandingStatus, LandingStatus[]> = {
  DRAFT: ["PUBLISHED", "ARCHIVED"],
  PUBLISHED: ["DRAFT", "ARCHIVED"],
  ARCHIVED: [],
};

export async function apiAdminGetLanding(offerId: string): Promise<LandingPage | null> {
  await delay();
  return load().landingPages[offerId] ?? null;
}

export interface CreateLandingInput {
  template?: string;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string[];
  ogImageUrl?: string;
}

export async function apiAdminCreateLanding(offerId: string, input: CreateLandingInput): Promise<LandingPage> {
  await delay();
  const s = load();
  if (s.landingPages[offerId]) throw new MockApiError("LANDING_ALREADY_EXISTS", "Bu offer uchun landing sahifa allaqachon mavjud.");
  const landing: LandingPage = {
    id: `landing_${Date.now()}`,
    offerId,
    template: input.template ?? "default",
    status: "DRAFT",
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
    seoKeywords: input.seoKeywords ?? [],
    ogImageUrl: input.ogImageUrl,
    createdAt: new Date().toISOString(),
  };
  s.landingPages[offerId] = landing;
  save();
  return landing;
}

export async function apiAdminUpdateLanding(offerId: string, patch: Partial<LandingPage>): Promise<LandingPage> {
  await delay();
  const s = load();
  const existing = s.landingPages[offerId];
  if (!existing) throw new MockApiError("NOT_FOUND", "Bu offer uchun landing sahifa topilmadi.");
  if (existing.status === "ARCHIVED") throw new MockApiError("LANDING_ARCHIVED", "Arxivlangan landing sahifani tahrirlab bo'lmaydi.");
  const updated = { ...existing, ...patch };
  s.landingPages[offerId] = updated;
  save();
  return updated;
}

function transitionLanding(offerId: string, to: LandingStatus): LandingPage {
  const s = load();
  const existing = s.landingPages[offerId];
  if (!existing) throw new MockApiError("NOT_FOUND", "Bu offer uchun landing sahifa topilmadi.");
  if (!LANDING_ALLOWED_TRANSITIONS[existing.status].includes(to)) {
    throw new MockApiError("INVALID_LANDING_TRANSITION", `Landing holatini "${existing.status}" dan "${to}" ga o'zgartirib bo'lmaydi.`);
  }
  const updated: LandingPage = {
    ...existing,
    status: to,
    publishedAt: to === "PUBLISHED" ? new Date().toISOString() : existing.publishedAt,
    archivedAt: to === "ARCHIVED" ? new Date().toISOString() : existing.archivedAt,
  };
  s.landingPages[offerId] = updated;
  save();
  return updated;
}

export async function apiAdminPublishLanding(offerId: string): Promise<LandingPage> {
  await delay();
  return transitionLanding(offerId, "PUBLISHED");
}

export async function apiAdminUnpublishLanding(offerId: string): Promise<LandingPage> {
  await delay();
  return transitionLanding(offerId, "DRAFT");
}

export async function apiAdminArchiveLanding(offerId: string): Promise<LandingPage> {
  await delay();
  return transitionLanding(offerId, "ARCHIVED");
}

// ---- Landing sections ----

export async function apiAdminGetLandingSections(offerId: string): Promise<LandingSectionAdmin[]> {
  await delay();
  return (load().landingSections[offerId] ?? []).sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function apiAdminAddLandingSection(offerId: string, type: LandingSectionType): Promise<LandingSectionAdmin> {
  await delay();
  const s = load();
  const list = s.landingSections[offerId] ?? [];
  const section: LandingSectionAdmin = {
    id: `sec_${Date.now()}`,
    offerId,
    type,
    sortOrder: list.length + 1,
    isActive: true,
    content: {},
  };
  s.landingSections[offerId] = [...list, section];
  save();
  return section;
}

function findSection(id: string): { offerId: string; index: number } | null {
  const s = load();
  for (const [offerId, list] of Object.entries(s.landingSections)) {
    const index = list.findIndex((sec) => sec.id === id);
    if (index >= 0) return { offerId, index };
  }
  return null;
}

export async function apiAdminUpdateLandingSection(id: string, patch: Partial<Pick<LandingSectionAdmin, "content" | "isActive">>): Promise<LandingSectionAdmin> {
  await delay();
  const s = load();
  const loc = findSection(id);
  if (!loc) throw new MockApiError("NOT_FOUND", "Section topilmadi.");
  const list = s.landingSections[loc.offerId]!;
  const updated = { ...list[loc.index]!, ...patch };
  list[loc.index] = updated;
  save();
  return updated;
}

export async function apiAdminToggleLandingSection(id: string): Promise<LandingSectionAdmin> {
  const loc = findSection(id);
  if (!loc) throw new MockApiError("NOT_FOUND", "Section topilmadi.");
  const current = load().landingSections[loc.offerId]![loc.index]!;
  return apiAdminUpdateLandingSection(id, { isActive: !current.isActive });
}

export async function apiAdminRemoveLandingSection(id: string): Promise<void> {
  await delay();
  const s = load();
  const loc = findSection(id);
  if (!loc) return;
  s.landingSections[loc.offerId] = s.landingSections[loc.offerId]!.filter((sec) => sec.id !== id).map((sec, i) => ({ ...sec, sortOrder: i + 1 }));
  save();
}

export async function apiAdminReorderLandingSections(offerId: string, orderedIds: string[]): Promise<LandingSectionAdmin[]> {
  await delay();
  const s = load();
  const list = s.landingSections[offerId] ?? [];
  const byId = new Map(list.map((sec) => [sec.id, sec]));
  const reordered = orderedIds.map((id, i) => ({ ...byId.get(id)!, sortOrder: i + 1 }));
  s.landingSections[offerId] = reordered;
  save();
  return reordered;
}

// ---- Campaigns (admin CRUD) ----

export interface CreateCampaignInput {
  offerId: string;
  name: string;
  internalName?: string;
  slug: string;
  category: string;
  description: string;
  internalNotes?: string;
  goal: string;
  targetAudience: string;
  platforms: SocialPlatform[];
  contentFormats: string[];
  requiredElements: string[];
  forbiddenElements: string[];
  referenceContent: string[];
  minFollowers?: number;
  maxFollowers?: number;
  requiredContentCount?: number;
  contentDeadline?: string;
  ctaLabel: string;
  startDate?: string;
  endDate?: string;
  applicationStartDate?: string;
  applicationDeadline: string;
  creatorLimit: number;
  commissionType: CommissionType;
  commissionRateBps?: number;
  commissionAmountMinor?: number;
  customerDiscountType?: DiscountType;
  customerDiscountValue?: number;
  barterEnabled: boolean;
  freeProduct?: string;
  attributionWindowDays: number;
  requiresApproval: boolean;
  assets?: CampaignAsset[];
}

export async function apiAdminGetCampaigns(): Promise<Campaign[]> {
  await delay();
  return [...CAMPAIGNS, ...load().campaignsExtra];
}

export async function apiAdminGetCampaign(id: string): Promise<Campaign | null> {
  await delay();
  return [...CAMPAIGNS, ...load().campaignsExtra].find((c) => c.id === id) ?? null;
}

export async function apiAdminCreateCampaign(input: CreateCampaignInput): Promise<Campaign> {
  await delay();
  const s = load();
  const offer = s.offers.find((o) => o.id === input.offerId);
  if (!offer) throw new MockApiError("NOT_FOUND", "Offer topilmadi.");
  const product = s.products.find((p) => p.id === offer.productId);
  const campaign: Campaign = {
    id: `camp_${Date.now()}`,
    offerId: input.offerId,
    slug: input.slug,
    name: input.name,
    coverImage: offer.slug,
    category: input.category,
    offer: {
      id: offer.id,
      name: offer.name,
      slug: offer.slug,
      productType: product?.type ?? "PHYSICAL_PRODUCT",
      priceMinor: offer.priceMinor,
      compareAtPriceMinor: offer.compareAtPriceMinor,
      currency: offer.currency,
    },
    description: input.description,
    goal: input.goal,
    targetAudience: input.targetAudience,
    platforms: input.platforms,
    contentFormats: input.contentFormats,
    requiredElements: input.requiredElements,
    forbiddenElements: input.forbiddenElements,
    referenceContent: input.referenceContent,
    startDate: input.startDate,
    endDate: input.endDate,
    ctaLabel: input.ctaLabel,
    commissionType: input.commissionType,
    commissionRateBps: input.commissionRateBps,
    commissionAmountMinor: input.commissionAmountMinor,
    customerDiscountType: input.customerDiscountType,
    customerDiscountValue: input.customerDiscountValue,
    barterEnabled: input.barterEnabled,
    freeProduct: input.freeProduct,
    applicationDeadline: input.applicationDeadline,
    creatorLimit: input.creatorLimit,
    approvedCreatorCount: 0,
    status: "DRAFT",
    requiresApproval: input.requiresApproval,
    attributionWindowDays: input.attributionWindowDays,
    assets: input.assets,
  };
  s.campaignsExtra = [campaign, ...s.campaignsExtra];
  audit(currentAdmin().displayName, "campaign.created", "Campaign", campaign.id, undefined, undefined, campaign);
  save();
  return campaign;
}

export async function apiAdminUpdateCampaign(id: string, patch: Partial<Campaign>): Promise<Campaign> {
  await delay();
  const s = load();
  const idx = s.campaignsExtra.findIndex((c) => c.id === id);
  if (idx < 0) throw new MockApiError("NOT_FOUND", "Faqat yangi yaratilgan kampaniyalar tahrirlanadi.");
  const before = s.campaignsExtra[idx]!;
  const updated = { ...before, ...patch };
  s.campaignsExtra[idx] = updated;
  audit(currentAdmin().displayName, "campaign.updated", "Campaign", id, undefined, before, updated);
  save();
  return updated;
}

// Dedicated transition verbs mirroring the real backend's ALLOWED_TRANSITIONS matrix — mock mode
// doesn't enforce the matrix strictly (no equivalent activation-eligibility checks), just delegates
// to the generic update, matching the same "good enough for UI wiring" pattern used for
// Offer/Landing's mock transition shims.
export async function apiAdminActivateCampaign(id: string): Promise<Campaign> {
  return apiAdminUpdateCampaign(id, { status: "ACTIVE" });
}

export async function apiAdminPauseCampaign(id: string): Promise<Campaign> {
  return apiAdminUpdateCampaign(id, { status: "PAUSED" });
}

export async function apiAdminCompleteCampaign(id: string): Promise<Campaign> {
  return apiAdminUpdateCampaign(id, { status: "COMPLETED" });
}

export async function apiAdminArchiveCampaign(id: string): Promise<Campaign> {
  return apiAdminUpdateCampaign(id, { status: "ARCHIVED" });
}

// ---- Campaign applications ----

export async function apiAdminGetCampaignApplications(): Promise<CampaignApplicationAdmin[]> {
  await delay();
  const s = load();
  const out: CampaignApplicationAdmin[] = [];
  for (const [userId, list] of Object.entries(s.creatorCampaigns)) {
    const user = getUserById(userId);
    for (const cc of list) {
      if (cc.status === "UNDER_REVIEW" || cc.status === "APPLIED" || cc.status === "REJECTED") {
        const status: CampaignApplicationStatus = cc.status === "REJECTED" ? "REJECTED" : cc.status === "UNDER_REVIEW" ? "PENDING" : "PENDING";
        out.push({
          id: cc.id,
          campaignId: cc.campaignId,
          campaignName: cc.campaign.name,
          creatorId: userId,
          creatorName: user?.displayName ?? "Creator",
          status,
          createdAt: cc.joinedAt,
          rejectionReason: cc.rejectionReason,
        });
      }
    }
  }
  return out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function apiAdminApproveCampaignApplication(userId: string, ccId: string): Promise<CreatorCampaign> {
  await delay();
  const s = load();
  const list = s.creatorCampaigns[userId] ?? [];
  const idx = list.findIndex((cc) => cc.id === ccId);
  if (idx < 0) throw new MockApiError("NOT_FOUND", "Ariza topilmadi.");
  const cc = list[idx]!;
  const allCampaigns = [...CAMPAIGNS, ...s.campaignsExtra];
  const campaignIdx = allCampaigns.findIndex((c) => c.id === cc.campaignId);
  const campaign = allCampaigns[campaignIdx];
  if (!campaign) throw new MockApiError("NOT_FOUND", "Kampaniya topilmadi.");
  if (campaign.approvedCreatorCount >= campaign.creatorLimit) {
    throw new MockApiError("CREATOR_LIMIT_REACHED", "Kampaniya uchun creator limiti to'lgan.");
  }
  const user = getUserById(userId);
  const creatorSlug = (user?.displayName ?? "creator").split(" ")[0] ?? "creator";
  const updated: CreatorCampaign = { ...cc, status: "APPROVED", ...generateReferralAssets(creatorSlug, campaign) };
  list[idx] = updated;
  s.creatorCampaigns[userId] = [...list];
  if (campaignIdx >= CAMPAIGNS.length) {
    s.campaignsExtra[campaignIdx - CAMPAIGNS.length] = { ...campaign, approvedCreatorCount: campaign.approvedCreatorCount + 1 };
  }
  audit(currentAdmin().displayName, "campaign_application.approved", "CreatorCampaign", ccId, undefined, cc, updated);
  save();
  return updated;
}

export async function apiAdminRejectCampaignApplication(userId: string, ccId: string, reason: string): Promise<CreatorCampaign> {
  await delay();
  if (!reason.trim()) throw new MockApiError("REASON_REQUIRED", "Rad etish sababini kiriting.");
  const s = load();
  const list = s.creatorCampaigns[userId] ?? [];
  const idx = list.findIndex((cc) => cc.id === ccId);
  if (idx < 0) throw new MockApiError("NOT_FOUND", "Ariza topilmadi.");
  const before = list[idx]!;
  const updated: CreatorCampaign = { ...before, status: "REJECTED", rejectionReason: reason };
  list[idx] = updated;
  s.creatorCampaigns[userId] = [...list];
  audit(currentAdmin().displayName, "campaign_application.rejected", "CreatorCampaign", ccId, reason, before, updated);
  save();
  return updated;
}

// ---- Creator management ----

export async function apiAdminGetCreators(): Promise<CreatorUser[]> {
  await delay();
  return allCreatorEmails()
    .map((email) => findCreatorByEmail(email))
    .filter((u): u is CreatorUser => !!u);
}

export async function apiAdminGetCreator(userId: string): Promise<CreatorUser | null> {
  await delay();
  return getUserById(userId);
}

export async function apiAdminGetCreatorCampaignHistory(userId: string): Promise<CreatorCampaign[]> {
  await delay();
  return load().creatorCampaigns[userId] ?? [];
}

export async function apiAdminGetCreatorStats(userId: string) {
  await delay();
  const sales = await apiGetSales(userId);
  const commissions = await apiGetCommissions(userId);
  const payouts = await apiGetPayouts(userId);
  return {
    totalOrders: sales.length,
    totalRevenueMinor: sales.reduce((a, s) => a + s.amountMinor, 0),
    totalCommissionMinor: commissions.reduce((a, c) => a + c.amountMinor, 0),
    totalPaidOutMinor: payouts.filter((p) => p.status === "PAID").reduce((a, p) => a + p.amountMinor, 0),
    clicks: (load().creatorCampaigns[userId] ?? []).reduce((a, cc) => a + (cc.referralLink?.clicks ?? 0), 0),
  };
}

export async function apiAdminApproveCreatorApplication(userId: string): Promise<CreatorUser["application"]> {
  await delay();
  const s = load();
  const current = s.applications[userId];
  if (!current) throw new MockApiError("NOT_FOUND", "Ariza topilmadi.");
  const updated = { ...current, status: "APPROVED" as const, reviewedAt: new Date().toISOString(), reviewNote: undefined };
  s.applications[userId] = updated;
  audit(currentAdmin().displayName, "creator_application.approved", "CreatorApplication", userId, undefined, current, updated);
  save();
  return updated;
}

export async function apiAdminRejectCreatorApplication(userId: string, reason: string): Promise<CreatorUser["application"]> {
  await delay();
  if (!reason.trim()) throw new MockApiError("REASON_REQUIRED", "Rad etish sababini kiriting.");
  const s = load();
  const current = s.applications[userId];
  if (!current) throw new MockApiError("NOT_FOUND", "Ariza topilmadi.");
  const updated = { ...current, status: "REJECTED" as const, reviewNote: reason, reviewedAt: new Date().toISOString() };
  s.applications[userId] = updated;
  audit(currentAdmin().displayName, "creator_application.rejected", "CreatorApplication", userId, reason, current, updated);
  save();
  return updated;
}

export async function apiAdminRequestCreatorRevision(userId: string, reason: string): Promise<CreatorUser["application"]> {
  await delay();
  if (!reason.trim()) throw new MockApiError("REASON_REQUIRED", "Tuzatish izohini kiriting.");
  const s = load();
  const current = s.applications[userId];
  if (!current) throw new MockApiError("NOT_FOUND", "Ariza topilmadi.");
  const updated = { ...current, status: "REVISION_REQUESTED" as const, reviewNote: reason, reviewedAt: new Date().toISOString() };
  s.applications[userId] = updated;
  audit(currentAdmin().displayName, "creator_application.revision_requested", "CreatorApplication", userId, reason, current, updated);
  save();
  return updated;
}

export async function apiAdminSetCreatorAccountStatus(userId: string, status: "ACTIVE" | "SUSPENDED" | "BLOCKED", reason?: string): Promise<void> {
  await delay();
  const s = load();
  s.accountStatus[userId] = status;
  audit(currentAdmin().displayName, `creator.${status.toLowerCase()}`, "CreatorUser", userId, reason);
  save();
}

// ---- Content moderation ----

export interface AdminContentRow {
  userId: string;
  creatorName: string;
  content: CreatorContent;
  campaign?: Campaign;
}

export async function apiAdminGetAllContent(): Promise<AdminContentRow[]> {
  await delay();
  const s = load();
  const allCampaigns = [...CAMPAIGNS, ...s.campaignsExtra];
  const out: AdminContentRow[] = [];
  for (const [userId, list] of Object.entries(s.content)) {
    const user = getUserById(userId);
    for (const content of list) {
      const cc = (s.creatorCampaigns[userId] ?? []).find((c) => c.id === content.creatorCampaignId);
      const campaign = cc ? allCampaigns.find((c) => c.id === cc.campaignId) : undefined;
      out.push({ userId, creatorName: user?.displayName ?? "Creator", content, campaign });
    }
  }
  return out.sort((a, b) => (a.content.updatedAt < b.content.updatedAt ? 1 : -1));
}

function updateContentStatus(userId: string, contentId: string, status: CreatorContentStatus, note?: string): CreatorContent {
  const s = load();
  const list = s.content[userId] ?? [];
  const idx = list.findIndex((c) => c.id === contentId);
  if (idx < 0) throw new MockApiError("NOT_FOUND", "Kontent topilmadi.");
  const now = new Date().toISOString();
  const before = list[idx]!;
  const updated: CreatorContent = { ...before, status, reviewNote: note, updatedAt: now, history: [...before.history, { status, note, at: now }] };
  list[idx] = updated;
  s.content[userId] = [...list];
  save();
  return updated;
}

export async function apiAdminApproveContent(userId: string, contentId: string): Promise<CreatorContent> {
  await delay();
  const updated = updateContentStatus(userId, contentId, "APPROVED");
  audit(currentAdmin().displayName, "content.approved", "CreatorContent", contentId);
  return updated;
}

export async function apiAdminRequestContentRevision(userId: string, contentId: string, note: string): Promise<CreatorContent> {
  await delay();
  if (!note.trim()) throw new MockApiError("REASON_REQUIRED", "Tuzatish izohini kiriting.");
  const updated = updateContentStatus(userId, contentId, "REVISION_REQUESTED", note);
  audit(currentAdmin().displayName, "content.revision_requested", "CreatorContent", contentId, note);
  return updated;
}

export async function apiAdminRejectContent(userId: string, contentId: string, reason: string): Promise<CreatorContent> {
  await delay();
  if (!reason.trim()) throw new MockApiError("REASON_REQUIRED", "Rad etish sababini kiriting.");
  const updated = updateContentStatus(userId, contentId, "REJECTED", reason);
  audit(currentAdmin().displayName, "content.rejected", "CreatorContent", contentId, reason);
  return updated;
}

// ---- Referral links / promo codes ----

export async function apiAdminGetReferralLinks(): Promise<AdminReferralLink[]> {
  await delay();
  const s = load();
  const out: AdminReferralLink[] = [];
  for (const [userId, list] of Object.entries(s.creatorCampaigns)) {
    const user = getUserById(userId);
    for (const cc of list) {
      if (!cc.referralLink) continue;
      const salesForLink = (s.dynamicSales[userId] ?? []).filter((sale) => sale.campaignName === cc.campaign.name);
      out.push({
        code: cc.referralLink.code,
        fullUrl: cc.referralLink.fullUrl,
        creatorId: userId,
        creatorName: user?.displayName ?? "Creator",
        campaignId: cc.campaignId,
        campaignName: cc.campaign.name,
        offerName: cc.campaign.offer.name,
        clicks: cc.referralLink.clicks,
        orders: salesForLink.length,
        revenueMinor: salesForLink.reduce((a, sale) => a + sale.amountMinor, 0),
        status: cc.status === "CANCELLED" || cc.status === "REJECTED" ? "EXPIRED" : "ACTIVE",
        createdAt: cc.referralLink.createdAt,
      });
    }
  }
  return out;
}

export async function apiAdminGetPromoCodes(): Promise<AdminPromoCode[]> {
  await delay();
  const s = load();
  const out: AdminPromoCode[] = [];
  for (const [userId, list] of Object.entries(s.creatorCampaigns)) {
    const user = getUserById(userId);
    for (const cc of list) {
      if (!cc.promoCode) continue;
      out.push({
        code: cc.promoCode.code,
        creatorId: userId,
        creatorName: user?.displayName ?? "Creator",
        campaignId: cc.campaignId,
        campaignName: cc.campaign.name,
        discountType: cc.promoCode.discountType,
        discountValue: cc.promoCode.discountValue,
        usageCount: (s.promoUsageCounts[cc.promoCode.code] ?? 0) || cc.promoCode.usageCount,
        usageLimit: cc.promoCode.usageLimit,
        isActive: cc.status !== "CANCELLED" && cc.status !== "REJECTED",
      });
    }
  }
  return out;
}

export async function apiAdminDeactivateReferralLink(code: string): Promise<void> {
  await delay();
  const s = load();
  for (const list of Object.values(s.creatorCampaigns)) {
    const cc = list.find((c) => c.referralLink?.code === code);
    if (cc) cc.status = "CANCELLED";
  }
  audit(currentAdmin().displayName, "referral_link.deactivated", "ReferralLink", code);
  save();
}

// ---- Visitors (lightweight synthetic log derived from referral links + orders) ----

export async function apiAdminGetVisitors(): Promise<AdminVisitor[]> {
  await delay();
  const links = await apiAdminGetReferralLinks();
  const s = load();
  const out: AdminVisitor[] = [];
  let i = 0;
  for (const link of links) {
    const visits = Math.max(link.clicks, link.orders * 3, 3);
    for (let v = 0; v < Math.min(visits, 5); v++) {
      i += 1;
      const isOrderVisit = v === 0 && link.orders > 0;
      out.push({
        id: `visit_${link.code}_${v}`,
        visitorId: `vis_${slugifyCode(link.code, String(v))}`,
        offerName: link.offerName,
        campaignName: link.campaignName,
        creatorName: link.creatorName,
        source: v % 3 === 0 ? "PROMO_CODE" : "REFERRAL_VISIT",
        landingPage: `/o/${slugifyCode(link.offerName)}`,
        createdAt: new Date(Date.now() - i * 3_600_000).toISOString(),
        expiresAt: new Date(Date.now() + (30 - i) * 86_400_000).toISOString(),
        attributedOrderToken: isOrderVisit ? s.orders.find((o) => o.attributedCreatorName === link.creatorName)?.publicToken : undefined,
        fraudRiskFlags: i % 11 === 0 ? ["HIGH_VELOCITY"] : [],
      });
    }
  }
  return out;
}

export async function apiAdminOverrideAttribution(orderId: string, newCreatorId: string, reason: string): Promise<void> {
  await delay();
  requireRole(currentAdmin().role, "SUPER_ADMIN");
  if (!reason.trim()) throw new MockApiError("REASON_REQUIRED", "Qo'lda o'zgartirish sababini kiriting.");
  const s = load();
  const order = s.adminOrders.find((o) => o.id === orderId);
  if (!order) throw new MockApiError("NOT_FOUND", "Buyurtma topilmadi.");
  const before = order.attributedCreatorId;
  const newCreator = getUserById(newCreatorId);
  order.attributedCreatorId = newCreatorId;
  order.attributedCreatorName = newCreator?.displayName;
  audit(currentAdmin().displayName, "attribution.manual_override", "Order", orderId, reason, before, newCreatorId);
  save();
}

// ---- Orders ----

const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "COMPLETED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "RETURNED"],
  DELIVERED: ["COMPLETED", "RETURNED"],
  COMPLETED: ["REFUNDED"],
  CANCELLED: [],
  RETURNED: ["REFUNDED"],
  REFUNDED: [],
};

export async function apiAdminGetOrders(): Promise<AdminOrder[]> {
  await delay();
  return load().adminOrders;
}

export async function apiAdminGetOrder(id: string): Promise<AdminOrder | null> {
  await delay();
  return load().adminOrders.find((o) => o.id === id) ?? null;
}

function transitionCommission(orderId: string, toStatus: OrderStatus) {
  const s = load();
  const order = s.adminOrders.find((o) => o.id === orderId);
  if (!order?.commissionId) return;
  const commission = s.adminCommissions.find((c) => c.id === order.commissionId);
  if (!commission) return;
  const now = new Date().toISOString();

  if ((toStatus === "DELIVERED" || toStatus === "COMPLETED") && commission.status === "PENDING") {
    commission.status = "PAYABLE";
    commission.ledger.push({ type: "ACCRUAL", amountMinor: 0, reason: "Approved & payable on fulfillment", at: now });
  } else if (toStatus === "CANCELLED" && commission.status === "PENDING") {
    commission.status = "REJECTED";
  } else if (toStatus === "REFUNDED") {
    commission.status = "REFUNDED";
    commission.ledger.push({ type: "REVERSAL", amountMinor: -commission.amountMinor, reason: "Order refunded", at: now });
  }

  // Mirror onto the creator-facing dynamic Commission/Sale so their own dashboard reflects it.
  if (order.attributedCreatorId) {
    const list = s.dynamicCommissions[order.attributedCreatorId] ?? [];
    const idx = list.findIndex((c) => c.id === commission.id);
    if (idx >= 0) list[idx] = { ...list[idx]!, status: commission.status };
    const salesList = s.dynamicSales[order.attributedCreatorId] ?? [];
    const saleIdx = salesList.findIndex((sale) => sale.orderPublicToken === order.publicToken);
    if (saleIdx >= 0) salesList[saleIdx] = { ...salesList[saleIdx]!, orderStatus: toStatus };
  }
}

export async function apiAdminUpdateOrderStatus(id: string, status: OrderStatus, note?: string): Promise<AdminOrder> {
  await delay();
  const s = load();
  const order = s.adminOrders.find((o) => o.id === id);
  if (!order) throw new MockApiError("NOT_FOUND", "Buyurtma topilmadi.");
  const allowed = ORDER_TRANSITIONS[order.status];
  if (!allowed.includes(status)) {
    throw new MockApiError("INVALID_TRANSITION", `${order.status} holatidan ${status} holatiga o'tib bo'lmaydi.`);
  }
  const before = order.status;
  order.status = status;
  order.statusHistory = [...order.statusHistory, { status, at: new Date().toISOString(), note, actor: currentAdmin().displayName }];
  transitionCommission(id, status);
  audit(currentAdmin().displayName, "order.status_changed", "Order", id, note, before, status);
  save();
  return order;
}

export async function apiAdminUpdateOrderNotes(id: string, internalNotes: string): Promise<AdminOrder> {
  await delay();
  const s = load();
  const order = s.adminOrders.find((o) => o.id === id);
  if (!order) throw new MockApiError("NOT_FOUND", "Buyurtma topilmadi.");
  order.internalNotes = internalNotes;
  save();
  return order;
}

// ---- Payments / refunds ----

export async function apiAdminGetPayments(): Promise<AdminOrder[]> {
  await delay();
  return load().adminOrders;
}

export async function apiAdminGetRefunds(): Promise<AdminRefund[]> {
  await delay();
  return load().refunds;
}

export async function apiAdminCreateRefund(orderId: string, amountMinor: number, reason: string, isPartial: boolean): Promise<AdminRefund> {
  await delay();
  if (!reason.trim()) throw new MockApiError("REASON_REQUIRED", "Refund sababini kiriting.");
  const s = load();
  const order = s.adminOrders.find((o) => o.id === orderId);
  if (!order) throw new MockApiError("NOT_FOUND", "Buyurtma topilmadi.");
  const refund: AdminRefund = {
    id: `refund_${Date.now()}`,
    orderId,
    orderPublicToken: order.publicToken,
    amountMinor,
    isPartial,
    reason,
    status: "PROCESSED",
    requestedAt: new Date().toISOString(),
    processedAt: new Date().toISOString(),
  };
  s.refunds = [refund, ...s.refunds];
  order.paymentStatus = "REFUNDED";
  await apiAdminUpdateOrderStatus(orderId, "REFUNDED", `Refund: ${reason}`);
  audit(currentAdmin().displayName, "refund.created", "Order", orderId, reason);
  save();
  return refund;
}

// ---- Commissions ----

export async function apiAdminGetCommissions(): Promise<AdminCommission[]> {
  await delay();
  return load().adminCommissions;
}

export async function apiAdminManualAdjustCommission(id: string, newAmountMinor: number, reason: string): Promise<AdminCommission> {
  await delay();
  requireRole(currentAdmin().role, "ADMIN");
  if (!reason.trim()) throw new MockApiError("REASON_REQUIRED", "Qo'lda o'zgartirish sababini kiriting.");
  const s = load();
  const commission = s.adminCommissions.find((c) => c.id === id);
  if (!commission) throw new MockApiError("NOT_FOUND", "Komissiya topilmadi.");
  const diff = newAmountMinor - commission.amountMinor;
  commission.amountMinor = newAmountMinor;
  commission.ledger.push({ type: diff >= 0 ? "ACCRUAL" : "REVERSAL", amountMinor: diff, reason, at: new Date().toISOString() });
  audit(currentAdmin().displayName, "commission.manual_adjustment", "Commission", id, reason);
  save();
  return commission;
}

// ---- Payouts ----

export async function apiAdminGetPayouts(): Promise<AdminPayout[]> {
  await delay();
  const s = load();
  const out: AdminPayout[] = [];
  for (const [userId, list] of Object.entries(s.payouts)) {
    const user = getUserById(userId);
    for (const p of list) {
      out.push({ id: p.id, creatorId: userId, creatorName: user?.displayName ?? "Creator", amountMinor: p.amountMinor, status: p.status, payoutMethodLabel: p.payoutMethodLabel, requestedAt: p.requestedAt, paidAt: p.paidAt, rejectionReason: p.rejectionReason });
    }
  }
  return out.sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1));
}

function findPayout(payoutId: string): { userId: string; index: number } | null {
  const s = load();
  for (const [userId, list] of Object.entries(s.payouts)) {
    const index = list.findIndex((p) => p.id === payoutId);
    if (index >= 0) return { userId, index };
  }
  return null;
}

export async function apiAdminApprovePayout(payoutId: string, referenceNumber: string): Promise<Payout> {
  await delay();
  const s = load();
  const loc = findPayout(payoutId);
  if (!loc) throw new MockApiError("NOT_FOUND", "Payout topilmadi.");
  const payout = s.payouts[loc.userId]![loc.index]!;
  if (payout.status === "PAID" || payout.status === "REJECTED") {
    throw new MockApiError("ALREADY_FINALIZED", "Bu payout allaqachon yakunlangan — qayta ishlab bo'lmaydi.");
  }
  const updated: Payout = { ...payout, status: "APPROVED" };
  s.payouts[loc.userId]![loc.index] = updated;
  audit(currentAdmin().displayName, "payout.approved", "Payout", payoutId, referenceNumber);
  save();
  return updated;
}

export async function apiAdminRejectPayout(payoutId: string, reason: string): Promise<Payout> {
  await delay();
  if (!reason.trim()) throw new MockApiError("REASON_REQUIRED", "Rad etish sababini kiriting.");
  const s = load();
  const loc = findPayout(payoutId);
  if (!loc) throw new MockApiError("NOT_FOUND", "Payout topilmadi.");
  const payout = s.payouts[loc.userId]![loc.index]!;
  if (payout.status === "PAID" || payout.status === "REJECTED") {
    throw new MockApiError("ALREADY_FINALIZED", "Bu payout allaqachon yakunlangan.");
  }
  const updated: Payout = { ...payout, status: "REJECTED", rejectionReason: reason };
  s.payouts[loc.userId]![loc.index] = updated;
  audit(currentAdmin().displayName, "payout.rejected", "Payout", payoutId, reason);
  save();
  return updated;
}

export async function apiAdminMarkPayoutPaid(payoutId: string, referenceNumber: string): Promise<Payout> {
  await delay();
  const s = load();
  const loc = findPayout(payoutId);
  if (!loc) throw new MockApiError("NOT_FOUND", "Payout topilmadi.");
  const payout = s.payouts[loc.userId]![loc.index]!;
  if (payout.status === "PAID") throw new MockApiError("ALREADY_PAID", "Bu payout allaqachon to'langan — ikki marta to'lab bo'lmaydi.");
  if (payout.status === "REJECTED") throw new MockApiError("ALREADY_FINALIZED", "Rad etilgan payoutni to'lab bo'lmaydi.");
  const updated: Payout = { ...payout, status: "PAID", paidAt: new Date().toISOString() };
  s.payouts[loc.userId]![loc.index] = updated;

  // Commissions batched into this payout move PAYABLE -> PAID together — mirrors the schema's
  // Commission.payoutId batching (see DATABASE.md) rather than a separate join table in the mock.
  const commissions = s.dynamicCommissions[loc.userId] ?? [];
  for (const c of commissions) if (c.status === "PAYABLE") c.status = "PAID";
  for (const c of s.adminCommissions) if (c.creatorId === loc.userId && c.status === "PAYABLE") c.status = "PAID";

  audit(currentAdmin().displayName, "payout.paid", "Payout", payoutId, referenceNumber);
  save();
  return updated;
}

// ---- Analytics ----

export interface AnalyticsFilters {
  campaignId?: string;
  offerId?: string;
  creatorId?: string;
}

export async function apiAdminGetAnalytics(filters: AnalyticsFilters = {}) {
  await delay();
  const s = load();
  const orders = s.adminOrders.filter(
    (o) =>
      (!filters.campaignId || o.campaignId === filters.campaignId) &&
      (!filters.offerId || o.offerId === filters.offerId) &&
      (!filters.creatorId || o.attributedCreatorId === filters.creatorId),
  );
  const paidOrders = orders.filter((o) => o.status !== "CANCELLED" && o.status !== "NEW");
  const revenueMinor = paidOrders.reduce((a, o) => a + o.totalMinor, 0);
  const commissionMinor = s.adminCommissions.reduce((a, c) => a + c.amountMinor, 0);
  const refundMinor = s.refunds.reduce((a, r) => a + r.amountMinor, 0);
  const creatorDriven = orders.filter((o) => o.attributedCreatorId);

  const byCreator = new Map<string, { name: string; revenueMinor: number; orders: number }>();
  for (const o of creatorDriven) {
    const key = o.attributedCreatorId!;
    const cur = byCreator.get(key) ?? { name: o.attributedCreatorName ?? "Creator", revenueMinor: 0, orders: 0 };
    cur.revenueMinor += o.totalMinor;
    cur.orders += 1;
    byCreator.set(key, cur);
  }
  const byOffer = new Map<string, { name: string; revenueMinor: number; orders: number }>();
  for (const o of orders) {
    const cur = byOffer.get(o.offerId) ?? { name: o.offerName, revenueMinor: 0, orders: 0 };
    cur.revenueMinor += o.totalMinor;
    cur.orders += 1;
    byOffer.set(o.offerId, cur);
  }
  const byCampaign = new Map<string, { name: string; revenueMinor: number; orders: number }>();
  for (const o of orders) {
    if (!o.campaignId) continue;
    const cur = byCampaign.get(o.campaignId) ?? { name: o.campaignName ?? "", revenueMinor: 0, orders: 0 };
    cur.revenueMinor += o.totalMinor;
    cur.orders += 1;
    byCampaign.set(o.campaignId, cur);
  }

  return {
    revenueMinor,
    netRevenueMinor: revenueMinor - refundMinor,
    ordersCount: orders.length,
    paidOrdersCount: paidOrders.length,
    conversionRate: 0.041,
    averageOrderValueMinor: paidOrders.length ? Math.round(revenueMinor / paidOrders.length) : 0,
    refundRate: orders.length ? s.refunds.length / orders.length : 0,
    creatorRevenueMinor: creatorDriven.reduce((a, o) => a + o.totalMinor, 0),
    directRevenueMinor: revenueMinor - creatorDriven.reduce((a, o) => a + o.totalMinor, 0),
    commissionLiabilityMinor: s.adminCommissions.filter((c) => c.status === "PAYABLE" || c.status === "APPROVED" || c.status === "PENDING").reduce((a, c) => a + c.amountMinor, 0),
    pendingPayoutsMinor: Object.values(s.payouts).flat().filter((p) => p.status === "REQUESTED" || p.status === "UNDER_REVIEW").reduce((a, p) => a + p.amountMinor, 0),
    topCreators: [...byCreator.values()].sort((a, b) => b.revenueMinor - a.revenueMinor).slice(0, 5),
    topOffers: [...byOffer.values()].sort((a, b) => b.revenueMinor - a.revenueMinor).slice(0, 5),
    topCampaigns: [...byCampaign.values()].sort((a, b) => b.revenueMinor - a.revenueMinor).slice(0, 5),
    funnel: {
      clicks: 1240,
      landingViews: 1180,
      checkoutStarts: 210,
      orders: orders.length,
      paidOrders: paidOrders.length,
    },
  };
}

export async function apiAdminExportAnalyticsCsv(): Promise<string> {
  await delay();
  const orders = load().adminOrders;
  const header = "order_id,offer,campaign,creator,status,total_minor,payment_method,created_at";
  const rows = orders.map((o) =>
    [o.id, o.offerName, o.campaignName ?? "", o.attributedCreatorName ?? "", o.status, o.totalMinor, o.paymentMethod, o.createdAt].join(","),
  );
  return [header, ...rows].join("\n");
}

// ---- Admin dashboard ----

export async function apiAdminGetDashboard() {
  await delay();
  const analytics = await apiAdminGetAnalytics();
  const s = load();
  const today = new Date().toDateString();
  const todayOrders = s.adminOrders.filter((o) => new Date(o.createdAt).toDateString() === today);
  const activeCampaigns = [...CAMPAIGNS, ...s.campaignsExtra].filter((c) => c.status === "ACTIVE");
  const genSeries = (days: number) =>
    Array.from({ length: days }, (_, i) => {
      const clicks = Math.round(30 + Math.random() * 80);
      const orders = Math.round(clicks * (0.03 + Math.random() * 0.02));
      return { date: new Date(Date.now() - (days - i) * 86_400_000).toISOString().slice(0, 10), clicks, orders, revenueMinor: orders * 400_000_00 };
    });
  const series30d = genSeries(30);
  const pendingApplications = (await apiAdminGetCampaignApplications()).filter((a) => a.status === "PENDING").length;
  const pendingContent = (await apiAdminGetAllContent()).filter((c) => c.content.status === "SUBMITTED" || c.content.status === "UNDER_REVIEW").length;
  const pendingPayouts = Object.values(s.payouts).flat().filter((p) => p.status === "REQUESTED" || p.status === "UNDER_REVIEW").length;

  return {
    todayRevenueMinor: todayOrders.reduce((a, o) => a + o.totalMinor, 0),
    monthlyRevenueMinor: analytics.revenueMinor,
    netRevenueMinor: analytics.netRevenueMinor,
    paidOrders: analytics.paidOrdersCount,
    conversionRate: analytics.conversionRate,
    averageOrderValueMinor: analytics.averageOrderValueMinor,
    refundRate: analytics.refundRate,
    creatorRevenueMinor: analytics.creatorRevenueMinor,
    directRevenueMinor: analytics.directRevenueMinor,
    commissionLiabilityMinor: analytics.commissionLiabilityMinor,
    pendingPayoutsMinor: analytics.pendingPayoutsMinor,
    activeCampaignsCount: activeCampaigns.length,
    topOffers: analytics.topOffers,
    topCreators: analytics.topCreators,
    funnel: analytics.funnel,
    series30d,
    series7d: series30d.slice(-7),
    series90d: genSeries(90),
    tasks: [
      pendingApplications > 0 ? { text: `${pendingApplications} ta campaign ariza ko'rib chiqilishi kerak`, href: "/admin/campaigns" } : null,
      pendingContent > 0 ? { text: `${pendingContent} ta kontent moderatsiya kutmoqda`, href: "/admin/content" } : null,
      pendingPayouts > 0 ? { text: `${pendingPayouts} ta payout so'rovi kutmoqda`, href: "/admin/payouts" } : null,
    ].filter((t): t is { text: string; href: string } => !!t),
  };
}

// ---- Users / roles / settings / audit ----

export async function apiAdminGetUsers(): Promise<AdminUser[]> {
  await delay();
  return Object.values(ADMIN_USERS);
}

export async function apiAdminGetRoles() {
  await delay();
  return [
    { role: "MANAGER" as AdminRole, permissions: ["Kontent moderatsiya", "Buyurtmalarni ko'rish", "Creator arizalarini ko'rish"] },
    { role: "ADMIN" as AdminRole, permissions: ["Barcha MANAGER huquqlari", "Product/Offer/Campaign yaratish", "Payout tasdiqlash", "Manual commission tuzatish"] },
    { role: "SUPER_ADMIN" as AdminRole, permissions: ["Barcha ADMIN huquqlari", "Manual attribution override", "Foydalanuvchi va rol boshqaruvi", "Tizim sozlamalari"] },
  ];
}

export async function apiAdminGetSettings() {
  await delay();
  return load().settings;
}

export async function apiAdminUpdateSettings(patch: Partial<PersistedState["settings"]>) {
  await delay();
  requireRole(currentAdmin().role, "SUPER_ADMIN");
  const s = load();
  s.settings = { ...s.settings, ...patch };
  audit(currentAdmin().displayName, "settings.updated", "Setting", "global", undefined, undefined, patch);
  save();
  return s.settings;
}

export async function apiAdminGetAuditLog(): Promise<AuditLogEntry[]> {
  await delay();
  return load().auditLog;
}
