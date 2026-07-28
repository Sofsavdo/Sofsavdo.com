import type { NotificationCategory } from "@prisma/client";
import { formatMoney } from "./format";

// Centralized templates (spec §6/§7) — every notification's copy for every channel lives here,
// nowhere else. Uzbek-only today (matching every other user-facing string in this codebase), but
// structured so a second locale is a new key in MESSAGES, not a rewrite of any call site: each
// template function takes typed variables and returns fully-rendered strings, never string
// concatenation scattered across the listener/sweep. HTML is only used where the channel can
// render it (Telegram's restricted subset, email); in-app and plain-text email bodies are plain.

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface NotificationTemplate<TVars> {
  category: NotificationCategory;
  inApp: (vars: TVars) => { title: string; body: string };
  telegram: (vars: TVars) => string;
  email: (vars: TVars) => RenderedEmail;
}

function emailShell(title: string, bodyHtml: string, bodyText: string): { html: string; text: string } {
  return {
    html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto"><h2>${title}</h2>${bodyHtml}<p style="color:#888;font-size:12px;margin-top:24px">Rosti — creator-affiliate platformasi</p></div>`,
    text: `${title}\n\n${bodyText}\n\n—\nRosti`,
  };
}

// ---- Creator: Campaign application lifecycle ----

interface CampaignApplicationVars {
  creatorName: string;
  campaignName: string;
}

export const campaignApplicationSubmitted: NotificationTemplate<CampaignApplicationVars> = {
  category: "CAMPAIGN_APPLICATION",
  inApp: (v) => ({ title: "Ariza yuborildi", body: `"${v.campaignName}" kampaniyasiga arizangiz yuborildi. Ko'rib chiqilgach xabar beramiz.` }),
  telegram: (v) => `📝 <b>Ariza yuborildi</b>\n"${v.campaignName}" kampaniyasiga arizangiz yuborildi.`,
  email: (v) => {
    const body = `<p>Salom, ${v.creatorName}!</p><p>"${v.campaignName}" kampaniyasiga arizangiz muvaffaqiyatli yuborildi. Ko'rib chiqilgach sizga xabar beramiz.</p>`;
    return { subject: "Arizangiz yuborildi", ...emailShell("Ariza yuborildi", body, `Salom, ${v.creatorName}! "${v.campaignName}" kampaniyasiga arizangiz yuborildi.`) };
  },
};

export const campaignApplicationApproved: NotificationTemplate<CampaignApplicationVars> = {
  category: "CAMPAIGN_APPLICATION",
  inApp: (v) => ({ title: "Ariza tasdiqlandi", body: `"${v.campaignName}" kampaniyasiga arizangiz tasdiqlandi!` }),
  telegram: (v) => `✅ <b>Ariza tasdiqlandi</b>\n"${v.campaignName}" kampaniyasiga arizangiz tasdiqlandi!`,
  email: (v) => {
    const body = `<p>Salom, ${v.creatorName}!</p><p>Tabriklaymiz — "${v.campaignName}" kampaniyasiga arizangiz tasdiqlandi.</p>`;
    return { subject: "Arizangiz tasdiqlandi", ...emailShell("Ariza tasdiqlandi", body, `Salom, ${v.creatorName}! "${v.campaignName}" kampaniyasiga arizangiz tasdiqlandi.`) };
  },
};

export const campaignApplicationRejected: NotificationTemplate<CampaignApplicationVars & { reason: string }> = {
  category: "CAMPAIGN_APPLICATION",
  inApp: (v) => ({ title: "Ariza rad etildi", body: `"${v.campaignName}" kampaniyasiga arizangiz rad etildi. Sabab: ${v.reason}` }),
  telegram: (v) => `❌ <b>Ariza rad etildi</b>\n"${v.campaignName}" kampaniyasiga arizangiz rad etildi.\nSabab: ${v.reason}`,
  email: (v) => {
    const body = `<p>Salom, ${v.creatorName}!</p><p>"${v.campaignName}" kampaniyasiga arizangiz rad etildi.</p><p><strong>Sabab:</strong> ${v.reason}</p>`;
    return { subject: "Arizangiz rad etildi", ...emailShell("Ariza rad etildi", body, `Salom, ${v.creatorName}! "${v.campaignName}" kampaniyasiga arizangiz rad etildi. Sabab: ${v.reason}`) };
  },
};

export const campaignJoined: NotificationTemplate<CampaignApplicationVars> = {
  category: "CAMPAIGN_APPLICATION",
  inApp: (v) => ({ title: "Kampaniyaga qo'shildingiz", body: `Siz endi "${v.campaignName}" kampaniyasi ishtirokchisisiz. Omad!` }),
  telegram: (v) => `🎉 <b>Kampaniyaga qo'shildingiz</b>\nSiz endi "${v.campaignName}" kampaniyasi ishtirokchisisiz.`,
  email: (v) => {
    const body = `<p>Salom, ${v.creatorName}!</p><p>Siz endi <strong>"${v.campaignName}"</strong> kampaniyasi ishtirokchisisiz. Promo materiallar va referral havolangizni shaxsiy kabinetingizda topasiz.</p>`;
    return { subject: "Kampaniyaga qo'shildingiz", ...emailShell("Kampaniyaga qo'shildingiz", body, `Salom, ${v.creatorName}! Siz endi "${v.campaignName}" kampaniyasi ishtirokchisisiz.`) };
  },
};

// ---- Admin: new campaign application ----

interface AdminCampaignApplicationVars {
  creatorName: string;
  campaignName: string;
  applicationId: string;
}

export const campaignApplicationNewAdmin: NotificationTemplate<AdminCampaignApplicationVars> = {
  category: "CAMPAIGN_APPLICATION",
  inApp: (v) => ({ title: "Yangi creator arizasi", body: `${v.creatorName} — "${v.campaignName}" kampaniyasiga ariza topshirdi.` }),
  telegram: (v) => `📥 <b>Yangi ariza</b>\n${v.creatorName} — "${v.campaignName}" kampaniyasiga ariza topshirdi.`,
  email: (v) => {
    const body = `<p><strong>${v.creatorName}</strong> "${v.campaignName}" kampaniyasiga ariza topshirdi (ID: ${v.applicationId}). Admin panelda ko'rib chiqing.</p>`;
    return { subject: "Yangi creator arizasi", ...emailShell("Yangi creator arizasi", body, `${v.creatorName} — "${v.campaignName}" kampaniyasiga ariza topshirdi.`) };
  },
};

// ---- Creator: Order lifecycle (sweep-sourced, Phase 8 data) ----

interface OrderVars {
  offerName: string;
  amountMinor: number;
  currency: string;
  orderPublicToken: string;
}

export const orderReceived: NotificationTemplate<OrderVars> = {
  category: "ORDER",
  inApp: (v) => ({ title: "Yangi sotuv!", body: `"${v.offerName}" bo'yicha ${formatMoney(v.amountMinor, v.currency)} miqdorida yangi buyurtma to'landi.` }),
  telegram: (v) => `💰 <b>Yangi sotuv!</b>\n"${v.offerName}" — ${formatMoney(v.amountMinor, v.currency)}`,
  email: (v) => {
    const body = `<p>"${v.offerName}" bo'yicha ${formatMoney(v.amountMinor, v.currency)} miqdorida yangi buyurtma to'landi (№${v.orderPublicToken}).</p>`;
    return { subject: "Yangi sotuv", ...emailShell("Yangi sotuv!", body, `"${v.offerName}" bo'yicha ${formatMoney(v.amountMinor, v.currency)} miqdorida yangi buyurtma to'landi.`) };
  },
};

export const orderDelivered: NotificationTemplate<Pick<OrderVars, "offerName" | "orderPublicToken">> = {
  category: "ORDER",
  inApp: (v) => ({ title: "Buyurtma yetkazildi", body: `"${v.offerName}" buyurtmangiz (№${v.orderPublicToken}) mijozga yetkazildi.` }),
  telegram: (v) => `📦 <b>Buyurtma yetkazildi</b>\n"${v.offerName}" (№${v.orderPublicToken})`,
  email: (v) => {
    const body = `<p>"${v.offerName}" buyurtmasi (№${v.orderPublicToken}) mijozga yetkazildi.</p>`;
    return { subject: "Buyurtma yetkazildi", ...emailShell("Buyurtma yetkazildi", body, `"${v.offerName}" buyurtmasi (№${v.orderPublicToken}) mijozga yetkazildi.`) };
  },
};

// ---- Creator: Commission settlement (sweep-sourced, Phase 9 data) ----

interface CommissionVars {
  amountMinor: number;
  currency: string;
}

export const commissionApproved: NotificationTemplate<CommissionVars> = {
  category: "COMMISSION",
  inApp: (v) => ({ title: "Komissiya tasdiqlandi", body: `${formatMoney(v.amountMinor, v.currency)} miqdoridagi komissiyangiz tasdiqlandi.` }),
  telegram: (v) => `✅ <b>Komissiya tasdiqlandi</b>\n${formatMoney(v.amountMinor, v.currency)}`,
  email: (v) => {
    const body = `<p>${formatMoney(v.amountMinor, v.currency)} miqdoridagi komissiyangiz tasdiqlandi.</p>`;
    return { subject: "Komissiya tasdiqlandi", ...emailShell("Komissiya tasdiqlandi", body, `${formatMoney(v.amountMinor, v.currency)} miqdoridagi komissiyangiz tasdiqlandi.`) };
  },
};

export const commissionPayable: NotificationTemplate<CommissionVars> = {
  category: "COMMISSION",
  inApp: (v) => ({ title: "Komissiya yechib olishga tayyor", body: `${formatMoney(v.amountMinor, v.currency)} miqdoridagi komissiyangiz endi yechib olish uchun mavjud.` }),
  telegram: (v) => `💸 <b>To'lovga tayyor</b>\n${formatMoney(v.amountMinor, v.currency)} yechib olish uchun mavjud.`,
  email: (v) => {
    const body = `<p>${formatMoney(v.amountMinor, v.currency)} miqdoridagi komissiyangiz endi balansingizda yechib olish uchun mavjud.</p>`;
    return { subject: "Komissiya to'lovga tayyor", ...emailShell("Komissiya to'lovga tayyor", body, `${formatMoney(v.amountMinor, v.currency)} miqdoringiz yechib olish uchun mavjud.`) };
  },
};

// ---- Creator: Payout lifecycle (sweep-sourced, Phase 9 data) ----

interface PayoutVars {
  amountMinor: number;
  currency: string;
}

export const payoutRequested: NotificationTemplate<PayoutVars> = {
  category: "PAYOUT",
  inApp: (v) => ({ title: "Payout so'rovi yuborildi", body: `${formatMoney(v.amountMinor, v.currency)} miqdoridagi payout so'rovingiz qabul qilindi.` }),
  telegram: (v) => `📤 <b>Payout so'rovi yuborildi</b>\n${formatMoney(v.amountMinor, v.currency)}`,
  email: (v) => {
    const body = `<p>${formatMoney(v.amountMinor, v.currency)} miqdoridagi payout so'rovingiz qabul qilindi va ko'rib chiqilmoqda.</p>`;
    return { subject: "Payout so'rovi qabul qilindi", ...emailShell("Payout so'rovi yuborildi", body, `${formatMoney(v.amountMinor, v.currency)} miqdoridagi payout so'rovingiz qabul qilindi.`) };
  },
};

export const payoutApproved: NotificationTemplate<PayoutVars> = {
  category: "PAYOUT",
  inApp: (v) => ({ title: "Payout tasdiqlandi", body: `${formatMoney(v.amountMinor, v.currency)} miqdoridagi payout so'rovingiz tasdiqlandi.` }),
  telegram: (v) => `✅ <b>Payout tasdiqlandi</b>\n${formatMoney(v.amountMinor, v.currency)}`,
  email: (v) => {
    const body = `<p>${formatMoney(v.amountMinor, v.currency)} miqdoridagi payout so'rovingiz tasdiqlandi va tayyorlanmoqda.</p>`;
    return { subject: "Payout tasdiqlandi", ...emailShell("Payout tasdiqlandi", body, `${formatMoney(v.amountMinor, v.currency)} miqdoridagi payout so'rovingiz tasdiqlandi.`) };
  },
};

export const payoutRejected: NotificationTemplate<PayoutVars & { reason: string }> = {
  category: "PAYOUT",
  inApp: (v) => ({ title: "Payout rad etildi", body: `${formatMoney(v.amountMinor, v.currency)} miqdoridagi payout so'rovingiz rad etildi. Sabab: ${v.reason}` }),
  telegram: (v) => `❌ <b>Payout rad etildi</b>\n${formatMoney(v.amountMinor, v.currency)}\nSabab: ${v.reason}`,
  email: (v) => {
    const body = `<p>${formatMoney(v.amountMinor, v.currency)} miqdoridagi payout so'rovingiz rad etildi.</p><p><strong>Sabab:</strong> ${v.reason}</p>`;
    return { subject: "Payout rad etildi", ...emailShell("Payout rad etildi", body, `${formatMoney(v.amountMinor, v.currency)} miqdoridagi payout so'rovingiz rad etildi. Sabab: ${v.reason}`) };
  },
};

export const payoutPaid: NotificationTemplate<PayoutVars> = {
  category: "PAYOUT",
  inApp: (v) => ({ title: "Payout to'landi", body: `${formatMoney(v.amountMinor, v.currency)} miqdoridagi payout hisobingizga o'tkazildi.` }),
  telegram: (v) => `🎉 <b>Payout to'landi</b>\n${formatMoney(v.amountMinor, v.currency)}`,
  email: (v) => {
    const body = `<p>${formatMoney(v.amountMinor, v.currency)} miqdoridagi payout hisobingizga muvaffaqiyatli o'tkazildi.</p>`;
    return { subject: "Payout to'landi", ...emailShell("Payout to'landi", body, `${formatMoney(v.amountMinor, v.currency)} miqdoridagi payout hisobingizga o'tkazildi.`) };
  },
};

// ---- Admin: financial alerts (sweep-sourced, Phase 8/9 data) ----

interface AdminPayoutVars extends PayoutVars {
  creatorName: string;
}

export const payoutRequestedAdmin: NotificationTemplate<AdminPayoutVars> = {
  category: "ADMIN_ALERTS",
  inApp: (v) => ({ title: "Yangi payout so'rovi", body: `${v.creatorName} — ${formatMoney(v.amountMinor, v.currency)} miqdorida payout so'radi.` }),
  telegram: (v) => `📥 <b>Yangi payout so'rovi</b>\n${v.creatorName} — ${formatMoney(v.amountMinor, v.currency)}`,
  email: (v) => {
    const body = `<p><strong>${v.creatorName}</strong> ${formatMoney(v.amountMinor, v.currency)} miqdorida payout so'radi. Admin panelda ko'rib chiqing.</p>`;
    return { subject: "Yangi payout so'rovi", ...emailShell("Yangi payout so'rovi", body, `${v.creatorName} — ${formatMoney(v.amountMinor, v.currency)} miqdorida payout so'radi.`) };
  },
};

export const payoutFailedAdmin: NotificationTemplate<AdminPayoutVars & { reason: string }> = {
  category: "ADMIN_ALERTS",
  inApp: (v) => ({ title: "Payout amalga oshmadi", body: `${v.creatorName} uchun ${formatMoney(v.amountMinor, v.currency)} miqdoridagi payout amalga oshmadi: ${v.reason}` }),
  telegram: (v) => `⚠️ <b>Payout amalga oshmadi</b>\n${v.creatorName} — ${formatMoney(v.amountMinor, v.currency)}\nSabab: ${v.reason}`,
  email: (v) => {
    const body = `<p><strong>${v.creatorName}</strong> uchun ${formatMoney(v.amountMinor, v.currency)} miqdoridagi payout amalga oshmadi.</p><p><strong>Sabab:</strong> ${v.reason}</p>`;
    return { subject: "Payout amalga oshmadi — e'tibor talab qilinadi", ...emailShell("Payout amalga oshmadi", body, `${v.creatorName} — ${formatMoney(v.amountMinor, v.currency)}. Sabab: ${v.reason}`) };
  },
};

export const paymentFailedAdmin: NotificationTemplate<{ orderPublicToken: string; amountMinor: number; currency: string; provider: string }> = {
  category: "ADMIN_ALERTS",
  inApp: (v) => ({ title: "To'lov amalga oshmadi", body: `Buyurtma №${v.orderPublicToken} (${v.provider}) uchun ${formatMoney(v.amountMinor, v.currency)} to'lovi amalga oshmadi.` }),
  telegram: (v) => `⚠️ <b>To'lov amalga oshmadi</b>\n№${v.orderPublicToken} (${v.provider}) — ${formatMoney(v.amountMinor, v.currency)}`,
  email: (v) => {
    const body = `<p>Buyurtma №${v.orderPublicToken} (${v.provider}) uchun ${formatMoney(v.amountMinor, v.currency)} to'lovi amalga oshmadi.</p>`;
    return { subject: "To'lov amalga oshmadi — e'tibor talab qilinadi", ...emailShell("To'lov amalga oshmadi", body, `№${v.orderPublicToken} (${v.provider}) — ${formatMoney(v.amountMinor, v.currency)}`) };
  },
};

// ---- Account (auth.service.ts direct emits, not sweep-sourced) ----

export const userRegisteredWelcome: NotificationTemplate<{ displayName: string }> = {
  category: "ACCOUNT",
  inApp: (v) => ({ title: "Xush kelibsiz!", body: `Salom, ${v.displayName}! Rosti platformasiga xush kelibsiz.` }),
  telegram: (v) => `👋 <b>Xush kelibsiz, ${v.displayName}!</b>`,
  email: (v) => {
    const body = `<p>Salom, ${v.displayName}!</p><p>Rosti — creator-affiliate platformasiga xush kelibsiz. Kampaniyalarga ariza topshirish va daromad olishni boshlashingiz mumkin.</p>`;
    return { subject: "Rosti platformasiga xush kelibsiz!", ...emailShell("Xush kelibsiz!", body, `Salom, ${v.displayName}! Rosti platformasiga xush kelibsiz.`) };
  },
};

// ---- Creator: Onboarding CreatorApplication lifecycle (Phase 11) ----
// Distinct from the campaignApplication* templates above (CampaignApplication — joining a
// Campaign); this is the onboarding admission decision. Uses the ACCOUNT category, same as
// userRegisteredWelcome/passwordResetRequested below — it's about the creator's own account
// status, not a per-campaign concern.

interface OnboardingVars {
  creatorName: string;
}

export const onboardingSubmitted: NotificationTemplate<OnboardingVars> = {
  category: "ACCOUNT",
  inApp: () => ({ title: "Ariza yuborildi", body: "Creator arizangiz yuborildi. Ko'rib chiqilgach xabar beramiz." }),
  telegram: () => `📝 <b>Ariza yuborildi</b>\nCreator arizangiz yuborildi. Ko'rib chiqilgach xabar beramiz.`,
  email: (v) => {
    const body = `<p>Salom, ${v.creatorName}!</p><p>Creator bo'lish arizangiz muvaffaqiyatli yuborildi. Ko'rib chiqilgach sizga xabar beramiz.</p>`;
    return { subject: "Arizangiz yuborildi", ...emailShell("Ariza yuborildi", body, `Salom, ${v.creatorName}! Creator arizangiz yuborildi.`) };
  },
};

export const onboardingApproved: NotificationTemplate<OnboardingVars> = {
  category: "ACCOUNT",
  inApp: () => ({ title: "Creator sifatida tasdiqlandingiz!", body: "Tabriklaymiz — endi platformaning barcha creator imkoniyatlaridan foydalanishingiz mumkin." }),
  telegram: () => `✅ <b>Tabriklaymiz!</b>\nSiz creator sifatida tasdiqlandingiz. Endi barcha imkoniyatlardan foydalanishingiz mumkin.`,
  email: (v) => {
    const body = `<p>Salom, ${v.creatorName}!</p><p>Tabriklaymiz — arizangiz tasdiqlandi va siz endi Rosti platformasida creator sifatida faoliyat yuritishingiz mumkin.</p>`;
    return { subject: "Creator sifatida tasdiqlandingiz!", ...emailShell("Tabriklaymiz!", body, `Salom, ${v.creatorName}! Siz creator sifatida tasdiqlandingiz.`) };
  },
};

export const onboardingRejected: NotificationTemplate<OnboardingVars & { reason: string }> = {
  category: "ACCOUNT",
  inApp: (v) => ({ title: "Ariza rad etildi", body: `Creator arizangiz rad etildi. Sabab: ${v.reason}` }),
  telegram: (v) => `❌ <b>Ariza rad etildi</b>\nSabab: ${v.reason}`,
  email: (v) => {
    const body = `<p>Salom, ${v.creatorName}!</p><p>Creator bo'lish arizangiz rad etildi.</p><p><strong>Sabab:</strong> ${v.reason}</p>`;
    return { subject: "Arizangiz rad etildi", ...emailShell("Ariza rad etildi", body, `Salom, ${v.creatorName}! Arizangiz rad etildi. Sabab: ${v.reason}`) };
  },
};

export const onboardingChangesRequested: NotificationTemplate<OnboardingVars & { reason: string }> = {
  category: "ACCOUNT",
  inApp: (v) => ({ title: "Arizada o'zgartirish talab qilinadi", body: `Creator arizangizga o'zgartirish talab qilindi: ${v.reason}` }),
  telegram: (v) => `✏️ <b>O'zgartirish talab qilindi</b>\n${v.reason}`,
  email: (v) => {
    const body = `<p>Salom, ${v.creatorName}!</p><p>Creator bo'lish arizangizni ko'rib chiqishda o'zgartirish talab qilindi.</p><p><strong>Sabab:</strong> ${v.reason}</p><p>Arizangizni tahrirlab qayta yuborishingiz mumkin.</p>`;
    return {
      subject: "Arizada o'zgartirish talab qilinadi",
      ...emailShell("O'zgartirish talab qilinadi", body, `Salom, ${v.creatorName}! Arizangizga o'zgartirish talab qilindi: ${v.reason}`),
    };
  },
};

interface AdminOnboardingVars {
  creatorName: string;
  applicationId: string;
}

export const onboardingNewAdmin: NotificationTemplate<AdminOnboardingVars> = {
  category: "ADMIN_ALERTS",
  inApp: (v) => ({ title: "Yangi creator arizasi", body: `${v.creatorName} creator bo'lish uchun ariza topshirdi.` }),
  telegram: (v) => `📥 <b>Yangi creator arizasi</b>\n${v.creatorName} creator bo'lish uchun ariza topshirdi.`,
  email: (v) => {
    const body = `<p><strong>${v.creatorName}</strong> creator bo'lish uchun ariza topshirdi (ID: ${v.applicationId}). Admin panelda ko'rib chiqing.</p>`;
    return { subject: "Yangi creator arizasi", ...emailShell("Yangi creator arizasi", body, `${v.creatorName} creator bo'lish uchun ariza topshirdi.`) };
  },
};

// Password reset is always sent (security-critical, explicitly user-initiated), never gated by
// NotificationPreference — see NotificationsService.dispatchPasswordReset.
export const passwordResetRequested: NotificationTemplate<{ resetUrl: string }> = {
  category: "ACCOUNT",
  inApp: () => ({ title: "Parolni tiklash", body: "Parolni tiklash so'rovi yuborildi." }),
  telegram: (v) => `🔑 <b>Parolni tiklash</b>\n${v.resetUrl}`,
  email: (v) => {
    const body = `<p>Parolingizni tiklash uchun quyidagi havolani bosing (15 daqiqa amal qiladi):</p><p><a href="${v.resetUrl}">${v.resetUrl}</a></p><p>Agar bu so'rovni siz yubormagan bo'lsangiz, bu xabarni e'tiborsiz qoldiring.</p>`;
    return { subject: "Parolni tiklash", ...emailShell("Parolni tiklash", body, `Parolingizni tiklash uchun havola: ${v.resetUrl}`) };
  },
};
