import { BRAND } from "../config/brand";

// The full catalog of platform settings this admin domain understands (Phase 12's 7 required
// categories) — the single source of truth for "what keys exist, what type each is, and what the
// default is when no `Setting` row exists yet" (same lazy-default convention as
// NotificationsService's DEFAULT_PREFERENCE — no backfill migration needed for a new key).
//
// Deliberately data-only: setting a value here changes what GET/PATCH /admin/settings reports and
// persists, not the runtime behavior of other domains. Wiring an individual setting into (say)
// checkout or registration would mean editing those frozen domains' logic, which is a separate,
// per-domain integration task this phase's own scope ("Admin Operations", not a rewrite of
// Checkout/Auth/Notifications) does not ask for — see DECISIONS.md ADR-019 for the explicit
// reasoning and PROJECT_STATUS.md for the honest "not yet wired" list.
export type SettingValueType = "string" | "number" | "boolean";

export interface SettingDefinition {
  category: SettingCategory;
  type: SettingValueType;
  default: string | number | boolean;
  label: string;
}

export const SETTING_CATEGORIES = ["general", "commission", "creatorDefaults", "notificationDefaults", "paymentConfiguration", "featureFlags", "validationRules"] as const;
export type SettingCategory = (typeof SETTING_CATEGORIES)[number];

export const SETTINGS_CATALOG: Record<string, SettingDefinition> = {
  "general.platformName": { category: "general", type: "string", default: BRAND.name, label: "Platforma nomi" },
  "general.supportEmail": { category: "general", type: "string", default: BRAND.supportEmail, label: "Qo'llab-quvvatlash emaili" },
  "general.supportPhone": { category: "general", type: "string", default: "+998 71 200 00 00", label: "Qo'llab-quvvatlash telefoni" },

  "commission.defaultCommissionRateBps": { category: "commission", type: "number", default: 2000, label: "Standart komissiya stavkasi (bazis punkt)" },
  "commission.payoutMinimumMinor": { category: "commission", type: "number", default: 10_000_000, label: "Minimal payout miqdori (tiyin)" },

  "creatorDefaults.defaultAttributionWindowDays": { category: "creatorDefaults", type: "number", default: 30, label: "Standart attribution muddati (kun)" },
  "creatorDefaults.requireApprovalForCampaigns": { category: "creatorDefaults", type: "boolean", default: true, label: "Kampaniyaga qo'shilish uchun tasdiq talab qilinsin" },

  "notificationDefaults.inAppEnabledByDefault": { category: "notificationDefaults", type: "boolean", default: true, label: "Ilova ichi bildirishnoma — standart holat" },
  "notificationDefaults.emailEnabledByDefault": { category: "notificationDefaults", type: "boolean", default: true, label: "Email bildirishnoma — standart holat" },
  "notificationDefaults.telegramEnabledByDefault": { category: "notificationDefaults", type: "boolean", default: false, label: "Telegram bildirishnoma — standart holat" },

  "paymentConfiguration.cashOnDeliveryEnabled": { category: "paymentConfiguration", type: "boolean", default: true, label: "Yetkazib berishda to'lov (COD) yoqilgan" },
  "paymentConfiguration.cardPaymentsEnabled": { category: "paymentConfiguration", type: "boolean", default: true, label: "Karta orqali to'lov yoqilgan" },

  "featureFlags.allowNewRegistrations": { category: "featureFlags", type: "boolean", default: true, label: "Yangi ro'yxatdan o'tish ochiq" },
  "featureFlags.maintenanceMode": { category: "featureFlags", type: "boolean", default: false, label: "Texnik xizmat rejimi" },

  "validationRules.minOrderAmountMinor": { category: "validationRules", type: "number", default: 10_000, label: "Minimal buyurtma summasi (tiyin)" },
  "validationRules.maxRefundWindowDays": { category: "validationRules", type: "number", default: 30, label: "Maksimal refund muddati (kun)" },
};

export type SettingKey = keyof typeof SETTINGS_CATALOG;
